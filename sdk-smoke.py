#!/usr/bin/env python3
"""通过 DeepSeek Harness Python SDK 真实运行一次 My Meme 对话。"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


# __file__ 是当前文件 sdk-smoke.py 的路径。
# parents[1] 向上两层，得到 deepseek-harness 仓库根目录。
REPO_ROOT = Path(__file__).resolve().parents[1]
MY_MEME_ROOT = REPO_ROOT / "my-meme"

# 本次 smoke test 使用的固定输入，以及期望出现的 Skill 和 Tool。
PROMPT = "Find me a crying reaction GIF."
EXPECTED_SKILL = "meme-selection"
EXPECTED_TOOL = "search_giphy"

# 当前 SDK 使用了 Python 3.10 才支持的类型语法，例如 list[dict[...]]。
if sys.version_info < (3, 10):
    raise SystemExit("My Meme SDK smoke requires Python 3.10 or newer.")

# 直接使用当前仓库里的 Python SDK 源码，而不是要求先把 SDK 安装到系统中。
# insert(0, ...) 把这个目录放在 Python 模块搜索路径的最前面。
sys.path.insert(0, str(REPO_ROOT / "python" / "sdk" / "src"))

from deepseek_harness import DeepSeekHarness  # noqa: E402


def require_environment() -> None:
    """启动前确认真实 API 调用所需的两个 Key 都存在。"""
    # os.environ 是当前 Python 进程继承到的环境变量集合。
    # 这里只检查变量有没有值，绝不会打印 Key 的内容。
    missing = [
        name
        for name in ("DEEPSEEK_API_KEY", "GIPHY_API_KEY")
        if not os.environ.get(name, "").strip()
    ]
    if missing:
        raise SystemExit(f"Missing required environment variable(s): {', '.join(missing)}")


def write_skill_patch(dsh_home: Path) -> Path:
    """生成临时配置，把仓库里的 My Meme Skill 挂载到 SDK profile。"""
    path = dsh_home / "my-meme-skill.patch.json"

    # Web UI 会从项目目录发现 Skill；SDK profile 需要显式指定 Skill 目录。
    # json.dumps() 把 Python 的 list/dict 转换为 JSON 字符串。
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


def write_session_jsonl(events: list[dict[str, object]], output: Path) -> None:
    """把 SDK 事件保存成现有 evaluator 能读取的 JSONL 文件。"""
    # parents=True 表示父目录不存在时一起创建；exist_ok=True 表示已存在也不报错。
    output.parent.mkdir(parents=True, exist_ok=True)

    # JSONL 格式是一行一个 JSON 对象。ensure_ascii=False 保留可读的中文字符。
    lines = [json.dumps(event, ensure_ascii=False, separators=(",", ":")) for event in events]
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def tool_calls(events: list[dict[str, object]]) -> list[dict[str, object]]:
    """提取所有 tool/call，并按照事件的 seq 排序。"""
    calls: list[tuple[int, dict[str, object]]] = []
    for event in events:
        # Session 中还有用户消息、模型回复、Tool 结果等事件；这里只关心 Tool 调用。
        if event.get("type") != "tool/call":
            continue
        seq = event.get("seq")
        data = event.get("data")

        # isinstance() 在运行时确认数据类型，避免格式异常导致后续代码出错。
        if isinstance(seq, int) and isinstance(data, dict):
            calls.append((seq, data))

    # lambda 接收 (seq, data)，用第一个元素 seq 作为排序键，最后只返回 data。
    return [data for _, data in sorted(calls, key=lambda item: item[0])]


def loaded_skill(calls: list[dict[str, object]]) -> bool:
    """判断 Model 是否调用 skill Tool 加载了 meme-selection 的完整内容。"""
    for call in calls:
        if call.get("name") != "skill":
            continue
        arguments = call.get("arguments")
        if not isinstance(arguments, str):
            continue
        try:
            # Tool arguments 在事件中是 JSON 字符串，需要先解析为 Python dict。
            parsed = json.loads(arguments)
        except json.JSONDecodeError:
            # 某条 arguments 不是合法 JSON 时忽略它，继续检查下一条。
            continue
        if isinstance(parsed, dict) and parsed.get("name") == EXPECTED_SKILL:
            return True
    return False


def skill_is_available(events: list[dict[str, object]]) -> bool:
    """判断 Session 收到的可用 Skill 目录中是否包含 meme-selection。"""
    catalog_marker = "<available_skills>"
    skill_entry = f"`{EXPECTED_SKILL}`"

    for event in events:
        # Harness 把可用 Skill 目录作为一条 user/message context 注入 Session。
        if event.get("type") != "user/message":
            continue
        data = event.get("data")
        if not isinstance(data, dict):
            continue
        content = data.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "text":
                continue
            text = block.get("text")
            if (
                isinstance(text, str)
                and catalog_marker in text
                and skill_entry in text
            ):
                return True
    return False


def run_smoke(output: Path, model: str) -> None:
    """真实运行 Agent，验证行为，并保存完整 Session JSONL。"""
    require_environment()

    # 每次运行创建唯一的项目内临时目录，退出时会整体删除。
    run_temp = Path(tempfile.mkdtemp(prefix=".sdk-smoke-run-", dir=MY_MEME_ROOT))
    dsh_home = run_temp / "dsh-home"
    dsh_home.mkdir()
    runtime_entry = REPO_ROOT / "apps" / "cli" / "src" / "bin.ts"

    # 这个现有配置负责注册 search_memes、generate_meme、search_giphy。
    plugin_patch = REPO_ROOT / "my-meme" / "plugins" / "cordis.yml"
    skill_patch = write_skill_patch(dsh_home)

    try:
        # with 会创建并启动 Harness；离开代码块时自动关闭它。
        with DeepSeekHarness(
            model=model,
            cwd=str(REPO_ROOT),
            runtime_cwd=str(REPO_ROOT),
            # 用仓库源码启动 DSH SDK profile，同时加载现有 Tools 和 Skill 配置。
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
                # 这里只补充 DSH 专用环境变量。
                # DEEPSEEK_API_KEY 和 GIPHY_API_KEY 会从当前 Python 进程继承。
                "DSH_HOME": str(dsh_home),
                "TMPDIR": str(run_temp),
                "DSH_PERMISSION_MODE": "danger-full-access",
                "DSH_TELEMETRY_DISABLED": "1",
            },
            request_timeout_seconds=120,
            shutdown_timeout_seconds=2,
        ) as harness:
            # run() 会发送 Prompt，并等待这一轮 Agent Loop 执行结束。
            result = harness.run(PROMPT, session_id="my-meme-sdk-smoke")

        # result.events 是本次 Session 的完整事件轨迹。
        write_session_jsonl(result.events, output)
        calls = tool_calls(result.events)
        names = [call.get("name") for call in calls]

        # “Skill 可用”和“Model 加载 Skill 全文”不是一回事。
        # 本测试要求 Skill 出现在 catalog 中，但明确请求下不强制 Model 加载全文。
        if not skill_is_available(result.events):
            raise AssertionError(
                f"Agent did not receive {EXPECTED_SKILL} in its Skill catalog"
            )
        if EXPECTED_TOOL not in names:
            raise AssertionError(f"Agent did not call {EXPECTED_TOOL}; calls: {names}")

        print(f"PASS: Skill available: {EXPECTED_SKILL}")
        if loaded_skill(calls):
            print(f"INFO: Model loaded Skill instructions: {EXPECTED_SKILL}")
        else:
            print(
                "INFO: Model did not need to load the Skill instructions "
                "for this explicit request"
            )
        print(f"PASS: called Tool: {EXPECTED_TOOL}")
        print(f"PASS: session JSONL: {output}")
        print(f"final_response={result.final_response}")
    finally:
        # 无论成功还是抛出异常，都删除本次运行产生的全部临时文件。
        shutil.rmtree(run_temp)


def main() -> None:
    """读取命令行参数，然后执行一次隔离的 SDK smoke test。"""
    parser = argparse.ArgumentParser()

    # --output 可覆盖 JSONL 输出位置；不传时使用下面的默认路径。
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / "my-meme" / "evals" / "sdk-smoke-session.jsonl",
    )
    parser.add_argument(
        "--model",
        # 如果设置了 DSH_MODEL 就使用它，否则默认使用 deepseek-v4-flash。
        default=os.environ.get("DSH_MODEL", "deepseek-v4-flash"),
    )
    args = parser.parse_args()
    run_smoke(args.output.resolve(), args.model)


# Python 直接执行此文件时 __name__ 等于 "__main__"；被 import 时则不会自动运行。
if __name__ == "__main__":
    main()
