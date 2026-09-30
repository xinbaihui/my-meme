# Evaluations

## Purpose

My Meme evaluations test agent behavior, not only the final answer. The current suite verifies tool selection, prohibited actions, and clarification order from DeepSeek Harness session trajectories.

## Current evaluation pipeline

```text
cases.json prompt
  -> run-suite.py starts an isolated Harness session
  -> agent produces a trajectory
  -> runner persists session JSONL
  -> behavior-evaluator.mjs reads tool/call events
  -> case result and suite summary
```

## Component responsibilities

The Python SDK is already used by both `sdk-smoke.py` and
`evals/run-suite.py`. It is the control interface for DeepSeek Harness, not a
replacement implementation of Harness and not merely a direct Model API
client.

```text
run-suite.py
  -> Harness Python SDK
  -> starts and controls the DSH Runtime
  -> creates an Agent Session and sends a prompt
  -> DSH assembles instructions, Skill catalog, and Tools
  -> DSH calls the DeepSeek Model
  -> Model decides whether to answer or call a Tool
  -> DSH executes Tools and continues the Agent Loop
  -> Python SDK returns the final response and Session events
  -> run-suite.py writes JSONL
  -> behavior-evaluator.mjs checks deterministic behavior rules
```

The components have separate responsibilities:

| Component | Responsibility |
|---|---|
| Python Runner (`run-suite.py`) | Reads cases, starts isolated sessions, supplies the E5 follow-up, saves JSONL, and starts the evaluator. |
| Harness Python SDK | Starts and controls a DSH Runtime from Python, sends prompts to sessions, and returns responses, events, and notifications. |
| DSH Runtime | Assembles the Agent, context, Skills, and Tools and drives the Model → Tool → Result → Model loop. |
| DeepSeek Model | Understands the request, reasons about the next action, selects Tools, and produces the response. |
| My Meme Tools | Perform the business actions: search Memegen, generate a meme, or search GIPHY. |
| Deterministic evaluator | Reads recorded Tool calls and decides whether execution satisfied the case rules. |

A direct Model API call normally resembles `Python → Model → response`. The
Harness SDK path is `Python → DSH Agent → Model → Tool → Model → response`.
The SDK acts as the external controller or client; the Agent Loop itself still
runs inside the DSH Runtime.

## E1–E5 behavior suite

`evals/cases.json` is the behavior specification. The Python Runner executes
its prompts automatically.

| Case | Behavior under test | Deterministic expectation |
|---|---|---|
| E1 | Find an existing “This is Fine” template. | Require `search_memes`; forbid `search_giphy` and `generate_meme`. |
| E2 | Find a crying reaction GIF. | Require `search_giphy`; forbid `search_memes` and `generate_meme`. |
| E3 | Generate from the explicit template ID `fine`. | Require `generate_meme`; forbid both search tools. |
| E4 | User delegates the content-type choice. | Forbid `ask_user_question`; do not constrain the valid route chosen. |
| E5 | User asks for something visual without choosing GIF or meme. | Turn 1 must not call a content tool; the runner supplies a fixed static-meme choice; turn 2 must call `search_memes`. |

E4 intentionally preserves agent autonomy. The evaluator enforces the product requirement—do not ask after delegation—without overfitting to one previously successful route.

## Deterministic evaluator

`evals/behavior-evaluator.mjs` reads newline-delimited session events and extracts ordered `tool/call` records:

```text
[{ name, seq }, ...]
```

It supports five constraints:

- `requiredTools`: every named tool must appear.
- `forbiddenTools`: none of the named tools may appear.
- `requiredBefore`: a required tool must occur before the first matching target tool.
- `requiredToolsInTurn`: every named tool must appear in the specified turn.
- `forbiddenToolsInTurn`: none of the named tools may appear in the specified turn.

The evaluator produces a reason for every PASS or FAIL and prints suite totals and pass rate. It uses event `seq`, not physical JSONL line numbers, to determine order.

### Run automatically

```bash
python my-meme/evals/run-suite.py
```

The runner reads `.env/keys.json` when the current process does not already
provide `DEEPSEEK_API_KEY` and `GIPHY_API_KEY`. It creates independent sessions,
writes `E1-session.jsonl` through `E5-session.jsonl`, and invokes the evaluator.

### Measure repeated-run reliability

Run one selected case multiple times in isolated sessions:

```bash
python my-meme/evals/run-suite.py --case E5 --runs 5
```

This writes `E5-run-01-session.jsonl` through
`E5-run-05-session.jsonl`. Each file is evaluated against the same E5 rules;
the final pass rate is the small-sample reliability rate for E5, not the pass
rate of five distinct behavior cases.

### Evaluate existing JSONL files directly

```bash
node evals/behavior-evaluator.mjs \
  E1=evals/E1-session.jsonl \
  E2=evals/E2-session.jsonl \
  E3=evals/E3-session.jsonl \
  E4=evals/E4-session.jsonl \
  E5=evals/E5-session.jsonl
```

Exit codes:

- `0`: all assigned cases pass.
- `1`: at least one behavior case fails.
- `2`: invalid input or evaluator execution error.

## Verified results

- The evaluator has been checked with known-good and known-bad E5 trajectories.
- E5 initially passed 2 of 5 isolated manual runs.
- After the Skill rule was strengthened with a condition, required action, forbidden pre-clarification actions, and a delegation exception, E5 passed 5 of 5 isolated runs.
- The current automated E1–E5 SDK suite has produced a 5/5 pass result.
- The first automated E5 repeated-run sample passed 4/5 isolated runs (80%). The failed trajectory called `search_memes` in turn 1 before presenting its content-type clarification.
- After moving a mandatory content-type gate before routing and explicitly forbidding preparatory candidate searches, the next E5 sample passed 5/5 isolated runs (100%).
- A subsequent unchanged retry passed 4/5. Across the two post-change samples, E5 passed 9/10 (90%); the remaining failure again searched in turn 1 before clarification.

These are small-sample development results, not a production reliability guarantee.

## SDK smoke test

`sdk-smoke.py` verifies agent composition through the Harness Python SDK. It checks that the SDK-launched request context contains the `meme-selection` Skill and all three meme tools.

This smoke test is not the Automated Eval Runner. It verifies configuration availability, not E1–E5 behavior end to end.

## Current limitations

- Required tool presence does not prove tool success or a valid final artifact.
- The suite does not score relevance, humor, tone, image quality, latency, cost, or repeated-run reliability automatically.
- E5 deterministically checks the two-turn tool behavior, but does not judge whether the first assistant text is a high-quality clarification question.
- Five distinct passing cases produce a suite pass rate; repeated executions of one case produce a reliability rate. These metrics must not be conflated.
