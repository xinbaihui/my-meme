#!/usr/bin/env python3
"""通过 DSH Python SDK 执行 E1–E5，再调用现有 deterministic evaluator。"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# run-suite.py 位于 my-meme/evals/，所以 parents[2] 是 deepseek-harness 根目录。
REPO_ROOT = Path(__file__).resolve().parents[2]
MY_MEME_ROOT = REPO_ROOT / "my-meme"
EVALS_DIR = MY_MEME_ROOT / "evals"
CASES_PATH = EVALS_DIR / "cases.json"
EVALUATOR_PATH = EVALS_DIR / "behavior-evaluator.mjs"
KEYS_PATH = REPO_ROOT / ".env" / "keys.json"
CONTENT_TOOLS = {"search_memes", "search_giphy", "generate_meme"}

# E5 的首轮 Prompt 故意含糊。Agent 正确提问后，Runner 用固定答案继续同一 Session。
E5_CLARIFICATION_RESPONSE = (
    "Choose a static meme template. Keep it light and sarcastic; do not generate it yet."
)

# 直接使用当前仓库中的 Python SDK 源码，不要求提前安装 SDK wheel。
if sys.version_info < (3, 10):
    raise SystemExit("My Meme Eval Runner requires Python 3.10 or newer.")
sys.path.insert(0, str(REPO_ROOT / "python" / "sdk" / "src"))

from deepseek_harness import DeepSeekHarness  # noqa: E402


def load_local_keys() -> None:
    """从本地 keys.json 补充缺失的环境变量，不覆盖终端已 export 的值。"""
    if not KEYS_PATH.is_file():
        return

    value = json.loads(KEYS_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TypeError(f"{KEYS_PATH} must contain a JSON object")

    for name in ("DEEPSEEK_API_KEY", "GIPHY_API_KEY"):
        key = value.get(name)
        if isinstance(key, str) and key.strip():
            # setdefault() 只在变量不存在时写入，因此终端 export 的值优先。
            os.environ.setdefault(name, key.strip())


def require_environment() -> None:
    """确认真实执行 Agent 所需的 API Key 已进入当前 Python 进程。"""
    missing = [
        name
        for name in ("DEEPSEEK_API_KEY", "GIPHY_API_KEY")
        if not os.environ.get(name, "").strip()
    ]
    if missing:
        raise SystemExit(f"Missing required environment variable(s): {', '.join(missing)}")


def load_cases() -> list[dict[str, object]]:
    """读取 cases.json, 并做本 Runner 所需的最小格式检查。"""
    value = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise TypeError("cases.json must contain a JSON array")

    cases: list[dict[str, object]] = []
    for item in value:
        if not isinstance(item, dict):
            raise TypeError("every eval case must be a JSON object")
        if not isinstance(item.get("id"), str) or not isinstance(item.get("prompt"), str):
            raise TypeError("every eval case must contain string id and prompt fields")
        cases.append(item)
    return cases


def positive_integer(value: str) -> int:
    """把命令行文本转换成大于零的整数。"""
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("value must be a positive integer")
    return parsed


def write_skill_patch(dsh_home: Path) -> Path:
    """让 SDK profile 使用 Web UI 当前使用的 meme-selection Skill。"""
    path = dsh_home / "my-meme-skill.patch.json"
    path.write_text(
        json.dumps(
            [
                {
                    "id": "skill-filesystem",
                    "config": {
                        "customSkillDirs": [str(REPO_ROOT / ".agents" / "skills")],
                        "watch": False,
                    },
                }
            ]
        ),
        encoding="utf-8",
    )
    return path


def write_jsonl(events: list[dict[str, object]], output: Path) -> None:
    """把一次 Session 的事件保存成一行一个 JSON 对象的 JSONL。"""
    lines = [json.dumps(event, ensure_ascii=False, separators=(",", ":")) for event in events]
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def called_tool_names(events: list[dict[str, object]]) -> set[str]:
    """从 Session 事件中取得所有被调用过的 Tool 名称。"""
    names: set[str] = set()
    for event in events:
        if event.get("type") != "tool/call":
            continue
        data = event.get("data")
        if isinstance(data, dict) and isinstance(data.get("name"), str):
            names.add(data["name"])
    return names


def run_cases(
    cases: list[dict[str, object]], model: str, runs: int
) -> list[str]:
    """在隔离 Session 中执行每个 case，并返回 evaluator 的文件参数。"""
    # 临时目录建在项目内，避免受限环境不能写系统临时目录。
    # 名称带随机后缀，因此并发运行时互不影响。
    run_temp = Path(tempfile.mkdtemp(prefix=".eval-run-", dir=MY_MEME_ROOT))
    dsh_home = run_temp / "dsh-home"
    dsh_home.mkdir()
    runtime_entry = REPO_ROOT / "apps" / "cli" / "src" / "bin.ts"
    plugin_patch = REPO_ROOT / "my-meme" / "plugins" / "cordis.yml"
    skill_patch = write_skill_patch(dsh_home)
    assignments: list[str] = []

    try:
        # 一个 Harness runtime 可以复用，但每个 case 使用不同 Session，避免上下文串扰。
        with DeepSeekHarness(
            model=model,
            cwd=str(REPO_ROOT),
            runtime_cwd=str(REPO_ROOT),
            _launch_args=(
                "node",
                "--import",
                "tsx",
                str(runtime_entry),
                "--profile",
                "sdk",
                "--patch",
                str(plugin_patch),
                "--patch",
                str(skill_patch),
            ),
            env={
                "DSH_HOME": str(dsh_home),
                # DSH 子进程产生的其他临时文件也统一放进本次专属目录。
                "TMPDIR": str(run_temp),
                "DSH_PERMISSION_MODE": "danger-full-access",
                "DSH_TELEMETRY_DISABLED": "1",
            },
            request_timeout_seconds=180,
            shutdown_timeout_seconds=2,
        ) as harness:
            for eval_case in cases:
                case_id = str(eval_case["id"])
                prompt = str(eval_case["prompt"])

                for run_number in range(1, runs + 1):
                    suffix = "" if runs == 1 else f"-run-{run_number:02d}"
                    output = EVALS_DIR / f"{case_id}{suffix}-session.jsonl"
                    session_id = f"my-meme-eval-{case_id.lower()}{suffix}"
                    session = harness.start_session(session_id)

                    run_label = case_id if runs == 1 else f"{case_id} {run_number}/{runs}"
                    print(f"\nRunning {run_label}: {prompt}", flush=True)
                    result = session.run(prompt)
                    events = list(result.events)

                    # Python SDK 没有 Web UI 的交互式选项。E5 第一轮只要没有擅自调用
                    # 内容 Tool，Runner 就用同一 Session 发送一个固定选择，形成第二轮。
                    names = called_tool_names(events)
                    if case_id == "E5" and names.isdisjoint(CONTENT_TOOLS):
                        print("Continuing E5 with a fixed clarification answer", flush=True)
                        follow_up = session.run(E5_CLARIFICATION_RESPONSE)
                        events.extend(follow_up.events)

                    write_jsonl(events, output)
                    assignments.append(f"{case_id}={output}")
                    print(f"Saved {run_label}: {output}", flush=True)

        return assignments
    finally:
        # 删除本次运行的整个临时目录；E1–E5 JSONL 保留在 evals/。
        shutil.rmtree(run_temp)


def run_evaluator(assignments: list[str]) -> int:
    """调用现有 JS evaluator，并原样返回它的 exit code。"""
    completed = subprocess.run(
        ["node", str(EVALUATOR_PATH), *assignments],
        cwd=REPO_ROOT,
        check=False,
    )
    return completed.returncode


def main() -> None:
    """执行 E1–E5，并以 evaluator 的结果作为本程序的退出状态。"""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default=os.environ.get("DSH_MODEL", "deepseek-v4-flash"),
        help="DSH model id (default: DSH_MODEL or deepseek-v4-flash)",
    )
    parser.add_argument(
        "--case",
        action="append",
        dest="case_ids",
        help="Run only this case id; repeat the option to select multiple cases",
    )
    parser.add_argument(
        "--runs",
        type=positive_integer,
        default=1,
        help="Number of isolated runs per selected case (default: 1)",
    )
    args = parser.parse_args()

    load_local_keys()
    require_environment()
    cases = load_cases()
    if args.case_ids:
        requested = set(args.case_ids)
        known = {str(eval_case["id"]) for eval_case in cases}
        unknown = sorted(requested - known)
        if unknown:
            parser.error(f"unknown case id(s): {', '.join(unknown)}")
        cases = [eval_case for eval_case in cases if eval_case["id"] in requested]

    assignments = run_cases(cases, args.model, args.runs)
    raise SystemExit(run_evaluator(assignments))


if __name__ == "__main__":
    main()
