# My Meme portfolio

This React + Vite frontend presents saved evaluation evidence. Live Chat is
provided by a separate, native DSH Web deployment. The page does not require
the Python API to be running.

## Pages

- `/` shows the E1–E5 evaluation results and recorded tool-call sequences.
- `/evals` remains usable as an older link to the same page.
- The header links to Evaluations and the My Meme GitHub repository. When a
  demo URL is configured, it also offers “Try My Meme”.

## Local development

Node.js >=22.13.0 is required. Install dependencies independently in this directory:

```bash
npm ci
npm run dev
```

From the repository root: `make dev-frontend`, `make build-frontend`, or
`make test-frontend`. npm and `package-lock.json` are the frontend workflow.
`npm run build` writes the static site to `frontend/dist/`.

## Live demo link

Copy `.env.example` to `.env.local`. The deployed interview entry is:

```text
https://121.40.130.20/demo
```

Nginx requires the shared interview credentials, then the loopback helper
redirects to the current DSH process token. The token stays in server memory
and is never included in frontend configuration. DSH and the helper run as the
`my-meme-dsh` systemd service on the ECS host.

For local-only development, set
`VITE_DSH_WEB_URL=http://127.0.0.1:3081/` and run:

```bash
node scripts/start-dsh.mjs
```

The helper launches native DSH on port 3080 and captures its current tokenized
startup URL. The fixed entry on port 3081 redirects to that URL. Each helper
restart picks up the new token automatically; it is held only in memory and
redirect responses are not cached. Stop an existing DSH process before using
the helper. Keep the helper running while using “Try My Meme”.

The link opens in a new tab. Restart frontend development or rebuild after
changing the environment setting. Without an address, the demo link is hidden.
This public setting must never contain a token or API key. The public entry
uses HTTPS and Nginx Basic Authentication. The local helper binds only to
loopback. The evaluation page does not require the Python API.

## Recorded evaluation evidence

```bash
npm run eval:snapshot
npm test
```

The snapshot exporter reads the root `evals/E1-session.jsonl` through
`E5-session.jsonl`, rechecks them with the existing behavior evaluator, and
writes `public/evaluations/snapshot.json`. It does not call a model or run new
Agent sessions. Source logs must be present locally to regenerate the snapshot.
The checked-in snapshot lets the public page run without those private logs.

Case specifications, behavior verdicts, tool names/sequence/turn, sanitized
per-call result status/count/reason, source timestamps and hashes are exported.
Tool arguments, results and raw messages are omitted. The original Agent run
code version was not captured. Repeated E5 run totals are documented separately,
not recomputed by the public page.

The rendered-page tests require the local source trajectories. They render the
homepage and older `/evals` URL in the Vite test environment and check that
evaluation evidence is presented and exported calls match local source records. Output checks use
the plugin-rendered text stored in those records; they do not fetch image URLs
or prove final-message delivery. Behavior and result-check totals are separate.
