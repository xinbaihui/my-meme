import { useState } from "react";
import SiteHeader from "../SiteHeader";
import report from "../../public/evaluations/snapshot.json";

const titles: Record<string, string> = { E1: "Template search", E2: "Reaction GIF search", E3: "Direct generation", E4: "Delegated choice", E5: "Clarify before action" };
const colors: Record<string, string> = { E1: "blue", E2: "pink", E3: "orange", E4: "green", E5: "violet" };

export default function EvaluationsPage() {
  const [selected, setSelected] = useState(report.cases[4]);
  const behaviorRate = Math.round(report.passed / report.total * 100);
  const resultRate = Math.round(report.resultsPassed / report.resultsApplicable * 100);
  return <main>
    <SiteHeader />
    <section className="eval-hero shell">
      <h1 className="visually-hidden">Evaluations</h1>
      <p className="score-note">One recorded evaluation run · {report.total} cases</p>
      <div className="score-metrics">
        <div className="score-metric"><strong className="score-ring">{behaviorRate}%</strong><span>Behavior · {report.passed} / {report.total} passed</span></div>
        <div className="score-metric"><strong className="score-ring">{resultRate}%</strong><span>Tool results · {report.resultsPassed} / {report.resultsApplicable} passed</span></div>
      </div>
    </section>
    <section className="eval-workspace shell">
      <div className="case-list">
        <div className="case-list-heading"><span>Case</span><span>Behavior</span><span>Tools called</span><span>Behavior / output</span></div>
        {report.cases.map(item => <button className={`case-row ${selected.id === item.id ? "selected" : ""}`} onClick={() => setSelected(item)} aria-pressed={selected.id === item.id} key={item.id}>
          <span className={`case-id ${colors[item.id]}`}>{item.id}</span><span><strong>{titles[item.id]}</strong><small>{item.prompt}</small></span>
          <code>{item.calls.filter(call => ["search_memes", "search_giphy", "generate_meme", "ask_user_question"].includes(call.name)).map(call => call.name).join(" → ") || "No content tool"}</code>
          <div className="case-verdicts"><span className={item.result === "PASS" ? "pass-badge" : "fail-badge"}>Behavior {item.result}</span><span className={!item.toolResults.applicable ? "neutral-badge" : item.toolResults.passed ? "pass-badge" : "fail-badge"}>Output {!item.toolResults.applicable ? "N/A" : item.toolResults.passed ? "PASS" : "FAIL"}</span></div>
        </button>)}
      </div>
      <aside className="case-detail">
        <div className="detail-top"><span className={`case-id ${colors[selected.id]}`}>{selected.id}</span><span className={selected.result === "PASS" ? "pass-badge" : "fail-badge"}>{selected.result}</span></div>
        <h2>{titles[selected.id]}</h2><span className="detail-label">Exact test prompt</span><blockquote>{selected.prompt}</blockquote>
        <span className="detail-label">Behavior under test</span><p>{selected.description}</p>
        <span className="detail-label">Behavior verdict</span>
        <ul className="constraint-list">
          {selected.requiredTools.length > 0 && <li>Require: {selected.requiredTools.join(", ")}</li>}
          {selected.forbiddenTools.length > 0 && <li>Forbid: {selected.forbiddenTools.join(", ")}</li>}
          {"forbiddenToolsInTurn" in selected && selected.forbiddenToolsInTurn?.map(rule => <li key={`forbid-${rule.turn}`}>Turn {rule.turn}: forbid {rule.tools.join(", ")}</li>)}
          {"requiredToolsInTurn" in selected && selected.requiredToolsInTurn?.map(rule => <li key={`require-${rule.turn}`}>Turn {rule.turn}: require {rule.tools.join(", ")}</li>)}
        </ul>
        {selected.id === "E5" && <p>The runner replies in turn 2: “Choose a static meme template. Keep it light and sarcastic; do not generate it yet.” The checks enforce no content tools in turn 1 and template search in turn 2; they do not independently prove question quality.</p>}
        <span className="detail-label">Tool result verdict</span><p>{selected.toolResults.reason}</p>
        <span className="detail-label">Recorded tool calls</span>
        <div className="mini-timeline">{selected.calls.map(call => <div key={call.seq}><code>seq {call.seq} · T{call.turn}</code><span>{call.name}</span></div>)}</div>
      </aside>
    </section>
  </main>;
}
