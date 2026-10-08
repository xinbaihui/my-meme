from __future__ import annotations

import re
from typing import Any

from .schemas import ActivityItem, MediaItem


CONTENT_TOOLS = {"search_giphy", "search_memes", "generate_meme"}


def _tool_result_text(event: dict[str, Any]) -> tuple[str | None, str]:
    """Return the tool call id and rendered text stored in a tool/result event."""
    data = event.get("data")
    if not isinstance(data, dict):
        return None, ""
    message = data.get("message")
    if not isinstance(message, dict):
        return None, ""
    source = message.get("source")
    call_id = source.get("callId") if isinstance(source, dict) else None
    texts: list[str] = []
    for outer in message.get("content", []):
        if not isinstance(outer, dict):
            continue
        for inner in outer.get("content", []):
            if isinstance(inner, dict) and inner.get("type") == "text":
                value = inner.get("text")
                if isinstance(value, str):
                    texts.append(value)
    return call_id if isinstance(call_id, str) else None, "\n".join(texts)


def _parse_giphy(text: str) -> list[MediaItem]:
    pattern = re.compile(
        r"### (?P<title>.+?)\nID: `(?P<id>[^`]+)`\n"
        r"!\[[^\]]*\]\((?P<preview>https?://[^)]+)\)\n"
        r"GIF URL: (?P<url>https?://\S+)",
        re.MULTILINE,
    )
    return [
        MediaItem(
            id=match.group("id"),
            title=match.group("title"),
            image_url=match.group("url"),
            preview_url=match.group("preview"),
            source="giphy",
            kind="gif",
        )
        for match in pattern.finditer(text)
    ]


def _parse_templates(text: str) -> list[MediaItem]:
    pattern = re.compile(
        r"### (?P<title>.+?)\nTemplate ID: `(?P<id>[^`]+)`\n"
        r"!\[[^\]]*\]\((?P<url>https?://[^)]+)\)",
        re.MULTILINE,
    )
    return [
        MediaItem(
            id=match.group("id"),
            title=match.group("title"),
            image_url=match.group("url"),
            preview_url=match.group("url"),
            source="memegen",
            kind="template",
        )
        for match in pattern.finditer(text)
    ]


def _parse_generated(text: str) -> list[MediaItem]:
    template = re.search(r"Template ID: `([^`]+)`", text)
    image = re.search(r"Image URL: (https?://\S+)", text)
    if not image:
        return []
    template_id = template.group(1) if template else "generated"
    return [
        MediaItem(
            id=template_id,
            title="Generated meme",
            image_url=image.group(1),
            preview_url=image.group(1),
            source="memegen",
            kind="generated",
        )
    ]


def map_events(events: list[dict[str, Any]]) -> tuple[list[ActivityItem], list[MediaItem]]:
    """Map raw DSH events to safe, product-facing activity and media items."""
    calls: dict[str, tuple[str, int | None]] = {}
    activity: list[ActivityItem] = []
    items: list[MediaItem] = []

    for event in sorted(events, key=lambda value: value.get("seq", 0)):
        event_type = event.get("type")
        data = event.get("data")
        seq = event.get("seq") if isinstance(event.get("seq"), int) else None

        if event_type == "tool/call" and isinstance(data, dict):
            name = data.get("name")
            call_id = data.get("callId")
            if isinstance(name, str) and isinstance(call_id, str):
                calls[call_id] = (name, seq)
                if name == "skill":
                    activity.append(ActivityItem(type="skill", label="Behavior skill loaded", detail="meme-selection", tool=name, seq=seq))
                elif name in CONTENT_TOOLS:
                    activity.append(ActivityItem(type="tool_started", label=f"Calling {name}", detail="External action started", tool=name, seq=seq))

        if event_type == "tool/result":
            call_id, text = _tool_result_text(event)
            if not call_id or call_id not in calls:
                continue
            name, _ = calls[call_id]
            if name == "search_giphy":
                parsed = _parse_giphy(text)
            elif name == "search_memes":
                parsed = _parse_templates(text)
            elif name == "generate_meme":
                parsed = _parse_generated(text)
            else:
                parsed = []
            if name in CONTENT_TOOLS:
                items.extend(parsed)
                activity.append(ActivityItem(type="tool_completed", label=f"{name} completed", detail=f"{len(parsed)} result{'s' if len(parsed) != 1 else ''} returned", tool=name, seq=seq))

    return activity, items
