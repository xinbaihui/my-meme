import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { evaluateToolResults } from '../../evals/tool-result-evaluator.mjs';

const root = new URL('../../', import.meta.url);
const cases = JSON.parse(await readFile(new URL('evals/cases.json', root), 'utf8'));
const assignments = cases.map(({ id }) => `${id}=${new URL(`evals/${id}-session.jsonl`, root).pathname}`);
const evaluation = spawnSync(process.execPath, [new URL('evals/behavior-evaluator.mjs', root).pathname, ...assignments], { encoding: 'utf8' });
if (evaluation.error || ![0, 1].includes(evaluation.status)) throw new Error(evaluation.stderr || String(evaluation.error));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const records = [];
for (const specification of cases) {
  const source = `evals/${specification.id}-session.jsonl`;
  const raw = await readFile(new URL(source, root), 'utf8');
  const events = raw.trim().split(/\r?\n/).map(line => JSON.parse(line));
  const result = evaluation.stdout.split('\n').find(line => line.startsWith(`${specification.id} `));
  const match = result?.match(/^E\d+ (PASS|FAIL) — (.+)$/);
  if (!match) throw new Error(`Missing evaluator result: ${specification.id}`);
  const dates = events.map(event => event.time ?? event.timestamp).filter(value => (typeof value === 'number' || typeof value === 'string') && !Number.isNaN(new Date(value).getTime())).map(value => new Date(value).toISOString());
  records.push({ ...specification, source, sourceSha256: hash(raw), recordedAt: dates[0] ?? null,
    result: match[1], reason: match[2], toolResults: evaluateToolResults(events, specification),
    calls: events.filter(event => event.type === 'tool/call').map(event => ({ name: event.data.name, seq: event.seq, turn: event.data.turn })).sort((a,b) => a.seq-b.seq) });
}
const report = { exportedAt: new Date().toISOString(), runCodeVersion: null,
  evaluatorSha256: hash(await readFile(new URL('evals/behavior-evaluator.mjs', root), 'utf8')),
  specificationsSha256: hash(await readFile(new URL('evals/cases.json', root), 'utf8')),
  resultEvaluatorSha256: hash(await readFile(new URL('evals/tool-result-evaluator.mjs', root), 'utf8')),
  scope: 'Tool behavior and recorded rendered-result structure. No URL fetching, final-message delivery, semantic or visual quality scoring.',
  resultsPassed: records.filter(record => record.toolResults.applicable && record.toolResults.passed).length,
  resultsApplicable: records.filter(record => record.toolResults.applicable).length,
  passed: records.filter(record => record.result === 'PASS').length, total: records.length, cases: records };
const destination = new URL('../public/evaluations/snapshot.json', import.meta.url);
await mkdir(new URL('.', destination), { recursive: true });
await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
console.log(`Exported ${report.passed}/${report.total} recorded cases. Raw logs, tool arguments and result payloads are excluded.`);
