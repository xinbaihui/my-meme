# Evaluations

## Purpose

My Meme evaluations test agent behavior, not only the final answer. The current suite verifies tool behavior and the structure of recorded business-tool results from DeepSeek Harness session trajectories.

## Current evaluation pipeline

```text
cases.json prompt
  -> run-suite.py starts an isolated Harness session
  -> agent produces a trajectory
  -> runner persists session JSONL
  -> behavior-evaluator.mjs reads tool/call events
  -> separate behavior and tool-result verdicts and suite summaries
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
[{ name, seq, turn }, ...]
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
make eval
```

The runner reads `.env/keys.json` when the current process does not already
provide `DEEPSEEK_API_KEY` and `GIPHY_API_KEY`. It creates independent sessions,
writes `E1-session.jsonl` through `E5-session.jsonl`, and invokes the evaluator.

### Measure repeated-run reliability

Run one selected case multiple times in isolated sessions:

```bash
.venv/bin/python evals/run-suite.py --case E5 --runs 5
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
- `1`: at least one behavior or tool-result check fails.
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

## Tool result validity

`evals/tool-result-evaluator.mjs` validates every recorded call to
`search_memes`, `search_giphy`, and `generate_meme`. The behavior cases and their
constraints are unchanged. The existing CLI now prints both verdicts, reports
separate totals, and returns exit code 1 if either dimension fails.

Calls and results are paired by `callId`; the result envelope's `toolCallId`
must agree, the result must follow the call, and the turn must match. Missing
or duplicate results, ambiguous call IDs, and unsupported envelopes fail.
The successful envelope must explicitly have `isError: false`; tool errors
are reported without exporting their raw text.

The source trajectories store rendered text, not the tools' original return
JSON. The validator therefore follows the plugin's current rendered-output
contract and does not claim to validate a raw JSON schema:

| Tool | Recorded fields checked |
|---|---|
| `search_memes` | Every candidate's nonempty title, template ID, HTTP(S) image URL, and keywords field. |
| `search_giphy` | Every candidate's nonempty title, ID, HTTP(S) preview URL and GIF URL. |
| `generate_meme` | Nonempty template ID and caption; matching HTTP(S) preview and image URL. |

Per-call statuses are `VALID`, `EMPTY`, `ERROR`, `INVALID`, or `MISSING`.
An explicit no-results response is `EMPTY`: a successful search with zero
artifacts, not an execution error. Each required business-tool route must
produce at least one `VALID` output, including required turn constraints.
Thus an empty required search alone fails the case, while an empty search
followed by valid results can pass. Every called business tool is checked;
an execution error remains a result-check failure even after recovery.
Cases with neither business calls nor required business output are `N/A` and
are excluded from the applicable-result denominator.

Image URLs are checked syntactically, without HTTP requests. Artifact counts
count returned candidates, not unique images or delivered final answers.
Results do not prove link availability, caption fidelity to the original
request, semantic relevance, visual quality, or final-response delivery.
Changing the plugin's rendered format requires updating this validator.

Run the offline result-validator regression tests (local E1–E5 logs required):

```bash
node --test evals/tests/tool-results.test.mjs
```

The tests cover real records and mutations for mismatched/missing/duplicate
results, explicit errors, malformed candidates, invalid URLs, generated-image
consistency, empty-search recovery, and not-applicable cases.

## Evidence on the portfolio

`frontend/src/pages/EvaluationsPage.tsx` reads the checked-in
`frontend/public/evaluations/snapshot.json`. This is an offline evidence
snapshot, not a live status dashboard or a model execution endpoint.

To regenerate it from the repository root:

```bash
cd frontend
npm run eval:snapshot
```

`frontend/scripts/export-evaluations.mjs` reads `evals/cases.json` and the five
local `E*-session.jsonl` records, runs the existing deterministic evaluator,
and exports each specification, behavior verdict, actual tool calls
(`name`, `seq`, `turn`), and separate sanitized tool-result checks. It supports failed case verdicts as well as
passing ones; unreadable records or evaluator execution errors stop export.
The exporter does not run new Agent sessions or use model credentials.

The snapshot also contains each record's first event timestamp and SHA-256,
the export time, and hashes of the evaluator and case specifications. These
original runs did not record the code version; `runCodeVersion` is null. The
page omits the metadata strip and source paths. None of
the saved evidence should be presented as a new live eval run.

Raw logs are Git-ignored and remain local. The public snapshot excludes raw
messages, tool arguments and tool results. Its included prompts are the test
specifications from `cases.json`. The committed snapshot lets the portfolio
build and display results even when raw records are absent. Regeneration and
the source-comparison test require those local records.

The current snapshot rechecks the saved suite at 5/5 behavior and 5/5 applicable tool-result cases. E5's 4/5 baseline and
9/10 post-change repeat-run totals are separate documented experiments; their
individual records are not included or recomputed by this snapshot. The page
shows the saved suite only and does not invent historical event sequences.
In the saved E5 record, template searches occur in turn 2; these checks alone
do not require an `ask_user_question` tool call in turn 1 or prove question quality.

To verify the portfolio and exported evidence:

```bash
cd frontend
npm test
```

The existing tests build and render the evaluation homepage without the Python
API, check sample labeling, and compare exported calls with local source records.
DSH Trajectory provides live execution inspection; the public evaluation page
provides a fixed, independently inspectable behavior sample.

For the complete run → snapshot → local page sequence, see the
[frontend instructions](../frontend/README.md#recorded-evaluation-evidence).

## SDK smoke test

`sdk-smoke.py` verifies one real agent route through the Harness Python SDK. It checks that the SDK-launched request context contains the `meme-selection` Skill and that a fixed GIF request calls `search_giphy`. It does not check the other two meme tools.

This smoke test is not the Automated Eval Runner. It verifies configuration availability, not E1–E5 behavior end to end.

## Current limitations

- Required tool presence alone does not prove success. Result checks now validate recorded success and structure, but not a valid delivered final artifact.
- The suite does not score relevance, humor, tone, image quality, latency, cost, or repeated-run reliability automatically.
- E5 deterministically checks the two-turn tool behavior, but does not judge whether the first assistant text is a high-quality clarification question.
- Five distinct passing cases produce a suite pass rate; repeated executions of one case produce a reliability rate. These metrics must not be conflated.
