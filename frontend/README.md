# My Meme portfolio

This React + Vite frontend presents the project overview and saved evaluation evidence.
Live Chat is provided by a separate, native DSH Web deployment. Neither page
requires the Python API to be running.

## Pages

- `/` is a compact Overview: project description, live-demo entry, and three
  short contributions (Skill, tools, evaluations).
- `/evals` holds the detailed case results, recorded tool-call sequences,
  snapshot metadata, downloadable evidence, and documented E5 repeat runs.
- The header links to Overview, Evaluations, and the My Meme GitHub repository.
  When a demo URL is configured, it also offers “Try My Meme”.

The Overview stays focused on the project and live demo. Detailed evidence is
reached through Evaluations in the header.

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
changing the environment setting. Without an address, the Overview shows
“Live demo coming soon”. This public setting must never contain a token or API
key. The public entry uses HTTPS and Nginx Basic Authentication. The local
helper binds only to loopback. Neither page requires the Python API.

## Recorded evaluation evidence

```bash
npm run eval:snapshot
npm test
```

The snapshot exporter reads the root `evals/E1-session.jsonl` through
`E5-session.jsonl`, rechecks them with the existing behavior evaluator, and
writes `public/evaluations/snapshot.json`. It does not call a model or run new
Agent sessions. Source logs must be present locally to regenerate the snapshot.
The checked-in snapshot lets the public pages run without those private logs.

Case specifications, behavior verdicts, tool names/sequence/turn, sanitized
per-call result status/count/reason, source timestamps and hashes are exported. Tool arguments, results and raw messages are omitted.
The original Agent run code version was not captured, so the page states
“Not recorded”; source hashes identify the input records and evaluator instead.
Repeated E5 run totals are separately labeled as documented experiments, not
recomputed snapshot results.

The rendered-page tests require the local source trajectories. They render the React routes in the Vite test environment and check that the portfolio
works without the Python backend, that evaluation evidence is presented as a
sample, and that exported calls match local source records. Output checks use
the plugin-rendered text stored in those records; they do not fetch image URLs
or prove final-message delivery. Behavior and result-check totals are separate.
