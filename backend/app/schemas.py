from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    session_id: str | None = Field(default=None, max_length=160)


class ActivityItem(BaseModel):
    type: Literal["skill", "tool_started", "tool_completed", "completed"]
    label: str
    detail: str
    tool: str | None = None
    seq: int | None = None


class MediaItem(BaseModel):
    id: str
    title: str
    image_url: str
    preview_url: str
    source: Literal["giphy", "memegen"]
    kind: Literal["gif", "template", "generated"]


class ChatResponse(BaseModel):
    session_id: str
    message: str
    response_type: Literal["gif_candidates", "meme_templates", "generated_meme", "text"]
    items: list[MediaItem]
    activity: list[ActivityItem]
    duration_ms: int


class HealthResponse(BaseModel):
    status: Literal["ok"]
    agent: str
