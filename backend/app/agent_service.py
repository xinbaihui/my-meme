from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import uuid
from pathlib import Path
from collections.abc import Callable
from typing import Any

from deepseek_harness import DeepSeekHarness, Notification

from .event_mapper import map_events
from .schemas import ActivityItem, ChatResponse


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DSH_HOME = Path(os.environ.get("DSH_HOME", PROJECT_ROOT / ".dsh-home")).resolve()
DSH_PROFILE = os.environ.get("DSH_PROFILE", "my-meme-sdk")


def load_local_keys() -> None:
    """Load development keys without replacing variables exported by the caller."""
    path = PROJECT_ROOT / ".env" / "keys.json"
    if not path.is_file():
        return
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        return
    for name in ("DEEPSEEK_API_KEY", "GIPHY_API_KEY"):
        key = value.get(name)
        if isinstance(key, str) and key.strip():
            os.environ.setdefault(name, key.strip())


def _write_skill_patch(directory: Path) -> Path:
    path = directory / "my-meme-skill.patch.json"
    path.write_text(
        json.dumps([
            {
                "id": "skill-filesystem",
                "config": {
                    "customSkillDirs": [str(PROJECT_ROOT / ".agents" / "skills")],
                    "watch": False,
                },
            }
        ]),
        encoding="utf-8",
    )
    return path


class AgentService:
    """Own one reusable DSH Runtime and serialize access to its SDK client."""

    def __init__(self) -> None:
        load_local_keys()
        self._lock = threading.Lock()
        self._harness: DeepSeekHarness | None = None
        self._temp: tempfile.TemporaryDirectory[str] | None = None
        self._sessions: dict[str, Any] = {}

    def _get_harness(self) -> DeepSeekHarness:
        if self._harness is not None:
            return self._harness
        missing = [name for name in ("DEEPSEEK_API_KEY", "GIPHY_API_KEY") if not os.environ.get(name, "").strip()]
        if missing:
            raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")
        runtime_temp = PROJECT_ROOT / ".runtime-tmp"
        runtime_temp.mkdir(parents=True, exist_ok=True)
        self._temp = tempfile.TemporaryDirectory(prefix="my-meme-api-", dir=runtime_temp)
        temp_path = Path(self._temp.name)
        patch = _write_skill_patch(temp_path)
        self._harness = DeepSeekHarness(
            model=os.environ.get("DSH_MODEL", "deepseek-v4-flash"),
            cwd=str(PROJECT_ROOT),
            runtime_cwd=str(PROJECT_ROOT),
            dsh_home=str(DSH_HOME),
            profile=DSH_PROFILE,
            patches=(str(patch),),
            env={
                "TMPDIR": str(temp_path),
                "DSH_PERMISSION_MODE": "danger-full-access",
                "DSH_TELEMETRY_DISABLED": "1",
            },
            request_timeout_seconds=180,
            shutdown_timeout_seconds=2,
        )
        self._harness.start()
        return self._harness

    def chat(
        self,
        message: str,
        session_id: str | None = None,
        on_update: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> ChatResponse:
        started = time.perf_counter()
        resolved_session = session_id or f"web-{uuid.uuid4().hex}"
        streamed_events: list[dict[str, Any]] = []
        activity_count = 0
        item_count = 0

        def handle_notification(notification: Notification) -> None:
            """Convert raw SDK notifications into safe, browser-facing updates."""
            nonlocal activity_count, item_count
            if on_update is None or notification.method != "session.event":
                return
            event = notification.payload.get("event")
            if not isinstance(event, dict):
                return
            streamed_events.append(event)
            current_activity, current_items = map_events(streamed_events)
            for activity_item in current_activity[activity_count:]:
                on_update("activity", activity_item.model_dump())
            for media_item in current_items[item_count:]:
                on_update("item", media_item.model_dump())
            activity_count = len(current_activity)
            item_count = len(current_items)

        with self._lock:
            harness = self._get_harness()
            session = self._sessions.get(resolved_session)
            if session is None:
                session = harness.start_session(resolved_session)
                self._sessions[resolved_session] = session
            result = session.run(message, on_notification=handle_notification)
        activity, items = map_events(list(result.events))
        duration_ms = round((time.perf_counter() - started) * 1000)
        if items and items[-1].kind == "generated":
            response_type = "generated_meme"
        elif items and items[0].kind == "gif":
            response_type = "gif_candidates"
        elif items:
            response_type = "meme_templates"
        else:
            response_type = "text"
        activity.append(ActivityItem(type="completed", label="Response ready", detail=f"Completed in {duration_ms}ms"))
        return ChatResponse(
            session_id=resolved_session,
            message=result.final_response,
            response_type=response_type,
            items=items,
            activity=activity,
            duration_ms=duration_ms,
        )

    def close(self) -> None:
        if self._harness is not None:
            self._harness.close()
            self._harness = None
            self._sessions.clear()
        if self._temp is not None:
            self._temp.cleanup()
            self._temp = None
