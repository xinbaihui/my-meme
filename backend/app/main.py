from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .agent_service import AgentService
from .schemas import ChatRequest, ChatResponse, HealthResponse


agent_service = AgentService()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    agent_service.close()


app = FastAPI(title="My Meme API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Local development servers may move from port 3000 when it is occupied.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", agent="my-meme")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        return await run_in_threadpool(
            agent_service.chat,
            request.message.strip(),
            request.session_id,
        )
    except Exception as error:
        # The public response intentionally excludes stack traces and secrets.
        raise HTTPException(status_code=502, detail=str(error)) from error


def _sse(event: str, data: dict[str, Any]) -> str:
    """Encode one Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Stream observable Agent activity, media results, and the final response."""

    async def event_stream():
        loop = asyncio.get_running_loop()
        updates: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()

        def on_update(event: str, data: dict[str, Any]) -> None:
            # SDK callbacks run in a worker thread. Transfer data safely to the
            # FastAPI event loop before yielding it to the browser.
            loop.call_soon_threadsafe(updates.put_nowait, (event, data))

        async def run_agent() -> None:
            try:
                response = await run_in_threadpool(
                    agent_service.chat,
                    request.message.strip(),
                    request.session_id,
                    on_update,
                )
                await updates.put(("result", response.model_dump()))
            except Exception as error:
                await updates.put(("error", {"message": str(error)}))
            finally:
                await updates.put(None)

        task = asyncio.create_task(run_agent())
        yield _sse("status", {"label": "Request received", "detail": "Agent execution started"})
        try:
            while True:
                update = await updates.get()
                if update is None:
                    break
                event, data = update
                yield _sse(event, data)
        finally:
            # The worker cannot be safely interrupted mid-Agent turn. Shielding
            # lets it release the shared SDK lock even if the browser disconnects.
            if not task.done():
                await asyncio.shield(task)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
