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
| Tool Result Validity | **Current next step** | Tool calls are checked, but successful and structurally valid Tool results are not yet evaluated. |

## Current next step

Evaluate Tool results and final artifact validity:

```text
tool call -> tool result -> deterministic artifact checks -> report
```

Success criteria:

- correlate each required Tool call with its recorded Tool result;
- distinguish a successful result from a Tool error;
- validate the minimum normalized fields required by each My Meme Tool;
- keep semantic relevance and visual quality out of deterministic checks;
- report behavior and result-validity failures separately when useful.

Reliability experiment: E5 initially passed 4/5 isolated runs. The failed run
loaded the Skill but called `search_memes` in turn 1 before clarification. A
single-variable Skill change moved the mandatory gate before routing and made
clear that preparatory candidate search is also forbidden. Two post-change
five-run samples passed 5/5 and 4/5, for 9/10 (90%) combined. The repeated
failure mode shows that a Skill instruction guides Model behavior but is not a
deterministic enforcement boundary.

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
