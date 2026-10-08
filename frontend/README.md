# My Meme portfolio

This frontend presents the project overview and saved evaluation evidence.
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
`make test-frontend`. npm and `package-lock.json` are the documented workflow;
the existing pnpm lockfile is retained.

## Live demo link

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_DSH_WEB_URL` to the
public DSH Web base address. The “Try My Meme” link opens in a new tab. Restart development or rebuild the production
site after changing it. Without an address, the overview shows “Live demo
coming soon” and does not link to a broken demo.

This is a public frontend variable. Do not put a launch token or API key in it.
DSH browser access must be arranged separately; the link does not bypass DSH
authentication. This site does not deploy DSH or connect its sessions to the
legacy Python API.

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

Only case specifications, verdicts, tool names/sequence/turn, source timestamps
and hashes are exported. Tool arguments, results and raw messages are omitted.
The original Agent run code version was not captured, so the page states
“Not recorded”; source hashes identify the input records and evaluator instead.
Repeated E5 run totals are separately labeled as documented experiments, not
recomputed snapshot results.

The rendered-page tests require the local source trajectories and run against the build and check that the portfolio
works without the Python backend, that evaluation evidence is presented as a
sample, and that exported calls match local source records.
