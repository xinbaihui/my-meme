# Learning Roadmap

## Goal

Use My Meme to learn agent application engineering through small, observable experiments: understand a concept, inspect the current behavior, change one variable, run the agent, evaluate the trajectory, and only then choose the next step.

## Progress

| Stage | Status | Evidence in My Meme |
|---|---|---|
| Agent fundamentals | Completed | A model chooses actions and iterates on tool observations toward a user goal. |
| Skill | Completed | `meme-selection` contains reusable routing and behavior policy. |
| Tool | Completed | Three structured external actions are exposed through `meme-tools`. |
| Routing | Completed | Requests route among GIF search, template search, generation, and clarification. |
| Agent Loop / Trajectory | Completed | Decisions, tool calls, observations, and stop behavior were inspected in Harness sessions. |
| State / Session | Completed at concept level | Harness sessions are used; explicit task state was evaluated and intentionally deferred. |
| Memory | Completed at boundary-design level | Conversation history, explicit state, and long-term memory have been distinguished; no memory system was added. |
| Error Handling / Fallback | Completed | Empty results, tool errors, retries, alternative paths, and intent preservation were tested. |
| HITL | Completed | Clarification is required only for material, non-delegated ambiguity. |
| Evaluation | Completed | Expected agent behavior is expressed as testable cases. |
| Deterministic Evaluator | Completed | Tool presence, absence, and ordering are checked from session events. |
| Eval Suite | Completed | E1–E5 run through one evaluator and produce a suite summary. |
| Automated Eval Runner | Completed | `run-suite.py` executes cases through isolated SDK sessions, saves JSONL, and invokes the existing evaluator. |
| Repeated-run Reliability | Completed at development-sample level | E5 scored 4/5 before the gate change and 9/10 across two post-change samples; Skill guidance improved but did not guarantee compliance. |
| Monorepo | Completed | One repository contains frontend, evaluation tools, and plugin; dependencies are independently installed without Nx or workspace hoisting. |
| Interview presentation | Implemented locally | Evaluations homepage and native DSH Web for live Chat. |
| Public evidence snapshot | Completed | Existing evaluator rechecks saved E1–E5 records; exported verdicts, sequences, timestamps and hashes are displayed without raw tool payloads. |
| Public demo deployment | Pending | Configure a hosted DSH Web destination and verify interviewer access before enabling the live-demo link. |
| Tool Result Validity | Completed for recorded structure | Calls correlate to explicit success/error envelopes; rendered artifact fields, empty results and required-route outputs are checked with regression tests. |
| Final Artifact Delivery | **Current next step** | Tool-result validity does not prove that the final answer delivers the intended artifact or preserves the requested caption. |

## Current next step

Evaluate final artifact delivery and caption fidelity:

```text
tool call -> validated tool result -> final response -> delivery checks
```

Result validity is implemented for the saved rendered-output contract and
passes 5/5 applicable cases. The separate behavior suite still passes 5/5.
Next checks should correlate usable result artifacts with the final answer and
compare generated captions with the explicit requested text. URL availability
and semantic/visual quality are separate questions; none is currently measured.

Reliability experiment: E5 initially passed 4/5 isolated runs. The failed run
loaded the Skill but called `search_memes` in turn 1 before clarification. A
single-variable Skill change moved the mandatory gate before routing and made
clear that preparatory candidate search is also forbidden. Two post-change
five-run samples passed 5/5 and 4/5, for 9/10 (90%) combined. The repeated
failure mode shows that a Skill instruction guides Model behavior but is not a
deterministic enforcement boundary.

## Interview delivery

The selected delivery plan is an independent evaluation page plus the unmodified
DSH Web interface for live use. Evaluation evidence appears at `/`, with `/evals`
retained as an older address. This avoids maintaining another Chat interaction
state machine. A customized DSH client remains an option, not the current plan.

The portfolio is implemented and has passed build and rendered-page/evidence
tests. Public DSH deployment and access verification are still pending. Set
`VITE_DSH_WEB_URL` after a public base address is available, then rebuild
the portfolio. No launch credential belongs in the frontend configuration.
The unused custom-Chat Python API was removed. A future Evaluation API should
be built around stored run data and used by the frontend if full-stack behavior
is added to the interview demo.

For that phase, first persist evaluation runs, case verdicts, and tool calls in
SQLite using a repeatable import from the existing JSONL records. Then expose
read endpoints for the latest run and a selected run, and have React fetch them
with loading and error states. Add a protected import or run trigger only after
the read path works; model credentials and raw trajectories must stay server-side.
Finally, deploy the API as a separate service behind Nginx `/api/` and test the
database, API responses, and browser flow together. This makes the backend part
of the product instead of retaining an unused Chat wrapper.

## Learning principles

- Keep project reasoning, decisions, implementation, and verification in the same long-running Work context when possible.
- Treat these documents and the repository as the durable source of truth; conversation history alone is not project documentation.
- Prefer one-variable experiments and compare against a baseline.
- Use deterministic checks whenever facts in the trajectory are sufficient.
- Add LLM-as-a-judge only for genuinely semantic or subjective quality requirements.
- Do not add explicit state, memory, tools, or frameworks before a demonstrated product need.
- Preserve established eval cases; add a new case for a new behavior instead of silently changing the old specification.

## Deferred topics

### RAG

RAG is intentionally paused. Meme selection does not currently provide a strong retrieval-grounding problem, so RAG should be learned in a future project with a real private or domain-specific knowledge corpus, citations, and measurable retrieval quality.

### MCP

MCP integration is not implemented. Revisit it when My Meme needs to consume tools or resources supplied by an MCP server and the integration teaches something beyond the existing plugin tools.

### Multi-agent systems

Multi-agent orchestration is not implemented. The current workflow is small enough for one agent with explicit Skills, Tools, and evaluations. Revisit multi-agent design only when independent roles or parallel work provide a measurable benefit.

## Later

Possible follow-up work, in priority order and only when justified:

1. Add semantic relevance and tone evaluation where deterministic rules are insufficient.
2. Track latency and external API cost.
3. Introduce explicit task state if longer editing workflows make history reconstruction unreliable.
