# My Meme

My Meme is a small agent application built on DeepSeek Harness. It selects between reaction GIF search and custom meme generation, then uses explicit routing, fallback, and clarification rules to complete the request.

This repository is also a learning project for agent application engineering. The project documentation is the source of truth for current behavior and planned work; coding agents should read it before making changes.

## Read first

- [Architecture](docs/architecture.md): runtime components, boundaries, and agent behavior.
- [Evaluations](docs/evals.md): E1–E5 behavior specifications and the current manual eval workflow.
- [Learning roadmap](docs/learning-roadmap.md): completed topics, current focus, and deferred topics.

## Current status

### Implemented and verified

- DeepSeek Harness runs the agent and records session trajectories.
- The `meme-selection` Skill defines content-type selection, tool routing, clarification, fallback, and stop conditions.
- The `meme-tools` plugin provides:
  - `search_memes`: searches Memegen templates.
  - `generate_meme`: generates a captioned image from a valid Memegen template ID.
  - `search_giphy`: searches GIPHY for reaction GIFs.
- Agent behavior has been inspected through Harness trajectories.
- A deterministic evaluator checks required tools, forbidden tools, and tool ordering.
- The Python SDK runner executes E1–E5 in isolated sessions, saves their JSONL trajectories, and invokes the deterministic evaluator.
- The automated E1–E5 behavior suite has produced a 5/5 pass result.
- The first E5 repeated-run sample passed 4/5 isolated runs (80%). After strengthening the Skill's mandatory content-type gate, two further samples passed 5/5 and 4/5, for a combined post-change result of 9/10 (90%).
- `sdk-smoke.py` verifies that an SDK-launched Harness instance can load the Skill and all three tools.

### Current limitations

- The evaluator checks tool-call behavior, not meme relevance, tone, visual quality, or tool-result quality.
- Repeated-run reliability measurements are a development signal, not a production guarantee.
- The application relies on conversation history for short multi-turn edits; it has no explicit task-state store or long-term memory system.
- RAG, MCP integration, and multi-agent orchestration are not implemented.

### Current next step

Evaluate Tool results and final artifact validity, not only Tool selection:

```text
tool call
  -> tool result
  -> validate returned artifact fields and success state
```

## Project layout

```text
my-meme/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── evals.md
│   └── learning-roadmap.md
├── evals/
│   ├── cases.json
│   ├── behavior-evaluator.mjs
│   ├── run-suite.py
│   └── E*-session*.jsonl
├── plugins/
│   ├── cordis.yml
│   └── src/meme-plugin.ts
└── sdk-smoke.py
```

The `meme-selection` Skill currently lives at the repository-level path `.agents/skills/meme-selection/SKILL.md`, where DeepSeek Harness discovers it.

## Local requirements

- A working DeepSeek Harness checkout and runtime.
- Node.js for the deterministic evaluator.
- Python and the local Harness Python SDK source for `sdk-smoke.py` and `run-suite.py`.
- `DEEPSEEK_API_KEY` for live Agent execution.
- `GIPHY_API_KEY` for live GIPHY search.
- Network access for the Memegen and GIPHY APIs.

## Run the current eval suite

```bash
python my-meme/evals/run-suite.py
```

Run one selected case repeatedly:

```bash
python my-meme/evals/run-suite.py --case E5 --runs 5
```

Exit codes:

- `0`: every assigned case passed.
- `1`: one or more behavior checks failed.
- `2`: evaluator input or execution error.

See [docs/evals.md](docs/evals.md) for case definitions and interpretation.
