"use client";

import { useState } from 'react';
import SiteHeader from '../../components/site-header';
import report from '../../public/evaluations/snapshot.json';

const titles: Record<string, string> = { E1: 'Template search', E2: 'Reaction GIF search', E3: 'Direct generation', E4: 'Delegated choice', E5: 'Clarify before action' };
const colors: Record<string, string> = { E1: 'blue', E2: 'pink', E3: 'orange', E4: 'green', E5: 'violet' };
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value)) + ' (UTC+8)' : 'Not recorded';
}

export default function EvaluationsPage() {
  const [selected, setSelected] = useState(report.cases[4]);
  const rate = Math.round(report.passed / report.total * 100);
  return <main>
    <SiteHeader active="evals" />
    <section className="eval-hero shell">
      <div><div className="eyebrow">RECORDED EVIDENCE · OFFLINE RECHECK</div><h1>Behavior you<br />can <span>verify.</span></h1><p>These results are computed from saved DSH trajectories. Each case checks tool selection and ordering, rather than judging only the final answer.</p></div>
      <div className="score-card"><div className="score-ring"><strong>{rate}</strong><span>%</span></div><div><span>ONE SUITE SAMPLE</span><h2>{report.passed} of {report.total} passed</h2><p>{report.total - report.passed} failed · behavior checks; result checks below</p></div></div>
    </section>
    <section className="snapshot-meta shell">
      <div><span>TRAJECTORY START</span><strong>{date(report.cases[0].recordedAt)}</strong></div>
      <div><span>SNAPSHOT EXPORTED</span><strong>{date(report.exportedAt)}</strong></div>
      <div><span>ORIGINAL RUN CODE VERSION</span><strong>Not recorded</strong></div>
      <a href="/evaluations/snapshot.json" download="my-meme-evaluation-snapshot.json">Download evidence snapshot ↓</a>
    </section>
    <section className="result-summary shell">
      <strong>Tool results: {report.resultsPassed} / {report.resultsApplicable} applicable cases passed</strong>
      <p>Calls are matched to results by call ID. Checks cover explicit success and required artifact fields in recorded tool output, including HTTP(S) URL syntax. Image availability and quality are not tested.</p>
    </section>
    <section className="eval-workspace shell">
      <div className="case-list">
        <div className="case-list-heading"><span>CASE</span><span>BEHAVIOR</span><span>TOOLS CALLED</span><span>BEHAVIOR / OUTPUT</span></div>
        {report.cases.map(item => <button className={`case-row ${selected.id === item.id ? 'selected' : ''}`} onClick={() => setSelected(item)} aria-pressed={selected.id === item.id} key={item.id}>
          <span className={`case-id ${colors[item.id]}`}>{item.id}</span><span><strong>{titles[item.id]}</strong><small>{item.prompt}</small></span>
          <code>{item.calls.filter(call => ['search_memes','search_giphy','generate_meme','ask_user_question'].includes(call.name)).map(call => call.name).join(' → ') || 'No content tool'}</code>
          <div className="case-verdicts"><span className={item.result === 'PASS' ? 'pass-badge' : 'fail-badge'}>Behavior {item.result}</span><span className={!item.toolResults.applicable ? 'neutral-badge' : item.toolResults.passed ? 'pass-badge' : 'fail-badge'}>Output {!item.toolResults.applicable ? 'N/A' : item.toolResults.passed ? 'PASS' : 'FAIL'}</span></div>
        </button>)}
      </div>
      <aside className="case-detail">
        <div className="detail-top"><span className={`case-id ${colors[selected.id]}`}>{selected.id}</span><span className={selected.result === 'PASS' ? 'pass-badge' : 'fail-badge'}>{selected.result}</span></div>
        <h2>{titles[selected.id]}</h2><span className="detail-label">EXACT TEST PROMPT</span><blockquote>{selected.prompt}</blockquote>
        <span className="detail-label">BEHAVIOR UNDER TEST</span><p>{selected.description}</p>
        <span className="detail-label">CHECKED CONSTRAINTS</span>
        <ul className="constraint-list">
          {selected.requiredTools.length > 0 && <li>Require: {selected.requiredTools.join(', ')}</li>}
          {selected.forbiddenTools.length > 0 && <li>Forbid: {selected.forbiddenTools.join(', ')}</li>}
          {'forbiddenToolsInTurn' in selected && selected.forbiddenToolsInTurn?.map(rule => <li key={`forbid-${rule.turn}`}>Turn {rule.turn}: forbid {rule.tools.join(', ')}</li>)}
          {'requiredToolsInTurn' in selected && selected.requiredToolsInTurn?.map(rule => <li key={`require-${rule.turn}`}>Turn {rule.turn}: require {rule.tools.join(', ')}</li>)}
        </ul>
        {selected.id === 'E5' && <p>The runner replies in turn 2: “Choose a static meme template. Keep it light and sarcastic; do not generate it yet.” The checks enforce no content tools in turn 1 and template search in turn 2; they do not independently prove question quality.</p>}
        <span className="detail-label">EVALUATOR VERDICT</span><p>{selected.reason}</p>
        <span className="detail-label">TOOL RESULT VERDICT</span>
        <p>{selected.toolResults.reason}</p>
        <div className="output-checks">{selected.toolResults.checks.map(check => <div key={check.callSeq}>
          <strong>{check.tool} · {check.status}</strong>
          <code>Call seq {check.callSeq} → result {check.resultSeq ?? 'missing'} · {check.artifactCount} artifact(s)</code>
          <p>{check.reason}</p>
        </div>)}</div>
        <span className="detail-label">RECORDED TOOL CALLS</span>
        <div className="mini-timeline">{selected.calls.map(call => <div key={call.seq}><code>seq {call.seq} · T{call.turn}</code><span>{call.name}</span></div>)}</div>
        <span className="detail-label">SOURCE RECORD</span><p className="source-record">{selected.source}<br />Started: {date(selected.recordedAt)}<br />SHA-256: {selected.sourceSha256}</p>
      </aside>
    </section>
    <section className="portfolio-section shell">
      <div className="section-heading"><h2>Passing once is not reliability.</h2></div>
      <div className="portfolio-grid">
        <article><span className="section-number">BASELINE · E5</span><h3>4 / 5 runs passed</h3><p>In one failed run, the Agent called search_memes before clarifying the visual format. This exposed a gap between policy instructions and actual behavior.</p></article>
        <article><span className="section-number">AFTER POLICY CHANGE · E5</span><h3>9 / 10 runs passed</h3><p>The Skill was strengthened with an explicit content-type gate. Two later samples scored 5/5 and 4/5. A failure remained, so the instruction is not a deterministic enforcement boundary.</p></article>
        <article><span className="section-number">EVIDENCE BOUNDARY</span><h3>Documented experiment</h3><p>Repeated-run numbers come from the project evaluation notes. Individual repeat-run logs are not included in this snapshot and these figures are not recomputed here.</p><a className="text-link" href="https://github.com/ellaxin/my-meme/blob/main/docs/evals.md" target="_blank" rel="noreferrer">Read evaluation notes ↗</a></article>
      </div>
    </section>
    <section className="method shell"><span className="section-number">HOW IT WORKS</span><div className="method-flow"><span>Prompt</span><b>→</b><span>Isolated DSH session</span><b>→</b><span>JSONL trajectory</span><b>→</b><span>Deterministic evaluator</span></div><p className="portfolio-note">This suite measures tool behavior. Tool result checks cover recorded structure, not live URL availability, final-message artifact delivery, meme relevance, tone, or visual quality. Live Trajectory inspection complements this saved evidence. The downloadable snapshot includes tool names, sequence numbers, rules and source hashes; it excludes raw messages, tool arguments and tool results.</p></section>
    <footer className="site-footer shell"><span>MY MEME · EVALUATION LAB</span><span>Required tools. Forbidden tools. Ordered behavior.</span></footer>
  </main>;
}
