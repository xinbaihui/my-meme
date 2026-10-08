# My Meme API

This retained API exposes the DSH Agent for SDK/custom-client integrations.
The current `frontend/` is a portfolio and evaluation viewer; it does not call
these endpoints. Live interview conversations run in native DSH Web, so the
API does not need to run for either portfolio page or native DSH Chat.
The API and DSH Web do not automatically share sessions or profiles.

## Optional startup

```bash
make install-backend PYTHON=python3.12
make dev-backend
```

Run from the repository root with Python 3.10+. Dependencies are installed into
`backend/.venv` from `backend/requirements.txt`. To reuse the current root
environment: `make dev-backend BACKEND_PYTHON=.venv/bin/python`.

Endpoints:

- `GET /api/health`
- `POST /api/chat`
- `POST /api/chat/stream` — SSE stream with `status`, `activity`, `item`,
  `result`, and `error` events

Example request:

```json
{
  "message": "Find me a crying reaction GIF.",
  "session_id": null
}
```
