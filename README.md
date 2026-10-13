# My Meme

My Meme is a small agent application built on DeepSeek Harness. It selects between reaction GIF search and custom meme generation, then uses explicit routing, fallback, and clarification rules to complete the request.

This repository is also a learning project for agent application engineering. The project documentation is the source of truth for current behavior and planned work; coding agents should read it before making changes.

## Read first

- [Architecture](docs/architecture.md): runtime components, boundaries, and agent behavior.
- [Evaluations](docs/evals.md): E1–E5 behavior specifications and the automated runner and public evidence snapshot.
- [Learning roadmap](docs/learning-roadmap.md): completed topics, current focus, and deferred topics.

## Current status

### Implemented and verified

- DeepSeek Harness runs the agent and records session trajectories.
- The `meme-selection` Skill defines content-type selection, tool routing, clarification, fallback, and stop conditions.
- The `meme-tools` plugin provides:
  - `search_memes`: searches Memegen templates.
  - `generate_meme`: generates a captioned image from a valid Memegen template ID.
  - `search_giphy`: searches GIPHY for reaction GIFs.
- The plugin is compatible with the DSH `0.2.0-rc.2` plugin API and can be
  installed in the built-in DSH Web UI for Chat and Trajectory inspection.
- Agent behavior has been inspected through Harness trajectories.
- A deterministic evaluator checks required tools, forbidden tools, and tool ordering. A separate result validator correlates business-tool calls with successful results and checks required artifact fields.
- The Python SDK runner executes E1–E5 in isolated sessions, saves their JSONL trajectories, and invokes the deterministic evaluator.
- The automated E1–E5 behavior suite has produced a 5/5 pass result.
- The first E5 repeated-run sample passed 4/5 isolated runs (80%). After strengthening the Skill's mandatory content-type gate, two further samples passed 5/5 and 4/5, for a combined post-change result of 9/10 (90%).
- `sdk-smoke.py` verifies that an SDK-launched Harness instance can load the Skill and all three tools.
- The independent React + Vite frontend presents a compact Overview and an Evaluations page.
- Evaluations renders real E1–E5 verdicts and tool-call sequences from an exported snapshot, with a downloadable evidence file.
- The live experience uses native DSH Web Chat and Trajectory; the portfolio does not implement its own Chat.

### Current limitations

- The evaluator checks behavior and rendered tool-result structure, not live image availability, relevance, tone, visual quality, or delivery in the final response.
- Repeated-run reliability measurements are a development signal, not a production guarantee.
- The application relies on conversation history for short multi-turn edits; it has no explicit task-state store or long-term memory system.
- RAG, MCP integration, and multi-agent orchestration are not implemented.
- The interview demo is published at `https://121.40.130.20/demo` behind HTTPS and Nginx Basic Authentication.
- The recorded Agent runs did not capture a code version; the evidence page reports this as “Not recorded”.

### Current next step

The portfolio now builds as a static React + Vite site. Next, deploy its
`frontend/dist/` output through the existing ECS Nginx server, then connect the
Evaluations page to the planned API. The native DSH Web demo is already
published at the protected `/demo` entry.

## Project layout

```text
my-meme/
├── frontend/              # Portfolio + evaluations; independent Node dependencies
├── backend/               # Python API, requirements.txt and local .venv
├── plugin/                # DSH plugin, package.json and pnpm-lock.yaml
├── .agents/skills/
├── docs/
├── evals/
├── Makefile
└── sdk-smoke.py
```

This is one Git repository without Nx or npm/pnpm workspaces. Each component
installs its own dependencies; there is no root dependency manifest, lockfile,
or hoisting. The DSH plugin remains in its existing `plugin/` directory.
The frontend uses npm and `package-lock.json`.

## Local startup

Start the portfolio in one terminal:

```bash
cd frontend
npm ci                 # first setup
npm run dev
```

In another terminal, from the repository root, start native DSH Chat:

```bash
node scripts/start-dsh.mjs
```

The helper launches DSH on port 3080 and automatically captures its current
startup token. “Try My Meme” uses the fixed entry on port 3081, which redirects
to that authenticated URL. Stop an existing DSH before launching the helper;
keep the helper running during the demo. The portfolio does not require the Python API.

The root `Makefile` is an optional shortcut collection, not a dependency manager:

| Command | Purpose |
|---|---|
| `make dev-dsh` | Launch native DSH and the automatic local demo entry. |
| `make dev-frontend` | Equivalent to `cd frontend && npm run dev`. |
| `make install-plugin` / `make build-plugin` | Install or build the independent `plugin/` package. |
| `make build` | Build the portfolio and plugin. |
| `make test-frontend` | Build and run portfolio/evidence tests; local source trajectories are required. |
| `make eval` | Run live E1–E5 sessions with `backend/.venv/bin/python`; requires credentials. |
| `make dev-backend` | Start the retained Python API; optional for the current showcase. |

For Python SDK workflows, use Python 3.10+ and
`make install-backend PYTHON=python3.12` (select an installed interpreter).
Use `BACKEND_PYTHON` to reuse an existing environment, for example
`make dev-backend BACKEND_PYTHON=.venv/bin/python`.

The former frontend Git metadata (including its index and history) is preserved
locally in `.repo-backups/frontend.git/`. Frontend source and pending edits now
belong to the root repository. Existing local DSH profiles continue to use `plugin/`.


The `meme-selection` Skill currently lives at the repository-level path `.agents/skills/meme-selection/SKILL.md`, where DeepSeek Harness discovers it.

## Local requirements

- Node.js >=22.13.0 for the frontend, and the DSH npm CLI for the native Web UI.
- Node.js for the deterministic evaluator.
- Python 3.10+ and dependencies from `backend/requirements.txt` for the optional API, SDK smoke test, and live eval runner.
- `DEEPSEEK_API_KEY` for live Agent execution.
- `GIPHY_API_KEY` for live GIPHY search.
- Network access for the Memegen and GIPHY APIs.

## Interview demo

The frontend is a project showcase with two pages:

- **Overview (`/`)**: a short project description, one live-demo entry, and three brief contributions (Skill, tools, evaluations). Detailed evidence stays on the Evaluations page.
- **Evaluations (`/evals`)**: accessed through the top navigation; shows case rules, actual calls, separate behavior/output verdicts, record timestamps, source hashes, and a downloadable snapshot. The repeated E5 experiment is described separately.


Native DSH Web provides the live Chat and Trajectory experience. The portfolio
pages can run without the Python API; the backend remains available for the
previous custom-Chat integration.

Configure `VITE_DSH_WEB_URL` in `frontend/.env.local` to link to DSH Web.
The interview deployment uses `https://121.40.130.20/demo`; restart development
or rebuild after changing the setting. Do not include a launch credential in
this public variable. Nginx authenticates visitors and the loopback helper
resolves the current process token. The existing DSH Web interface is published
directly rather than embedded in an iframe or replaced by a custom DSH client.
See [DSH demo setup](docs/dsh.md).

The evaluation page consumes a checked-in, sanitized snapshot derived from
saved E1–E5 trajectories using the real evaluator. Regenerate it with:

```bash
cd frontend
npm run eval:snapshot
```

See [frontend/README.md](frontend/README.md) for the snapshot scope and demo
configuration. The repeat-run experiment is labeled separately from the
recomputed suite, and the original run code version is marked as unrecorded.

## Run the built-in DSH Chat and Trajectory UI

From the repository root, start the built-in Web UI:

```bash
node scripts/start-dsh.mjs
```

The helper automatically captures the new token on each launch; no token is
saved in frontend configuration. It uses the current DSH configuration. There is no need to set `DSH_HOME`
for this startup command. If your shell already exports `DSH_HOME`, DSH uses
that setting.

For a fresh setup that has not installed the local plugin yet, initialize the
Web profile and install the plugin using the same DSH configuration:

```bash
npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh web --help
npm_config_cache="$PWD/.npm-cache" npx --yes @deepseek-ai/dsh plugin --profile web add "$PWD/plugin"
```

The plugin's declared API compatibility is DSH `0.2.0-rc.2`; the startup
command above does not pin the CLI version.

Open the complete tokenized URL printed by the command. Because the command is
run from the repository root, the Web workspace can use the repository-level
`.agents/skills/meme-selection/SKILL.md`. Select the My Meme repository as the
Web workspace so the Skill can be discovered. Export `DEEPSEEK_API_KEY` and
`GIPHY_API_KEY` before starting when live model and GIPHY calls are required.

## Run the current eval suite

```bash
backend/.venv/bin/python evals/run-suite.py
```

Run one selected case repeatedly:

```bash
backend/.venv/bin/python evals/run-suite.py --case E5 --runs 5
```

Exit codes:

- `0`: every assigned case passed.
- `1`: one or more behavior checks failed.
- `2`: evaluator input or execution error.

See [docs/evals.md](docs/evals.md) for case definitions and interpretation.
