import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { evaluateToolResults } from '../tool-result-evaluator.mjs';
const cases = JSON.parse(await readFile(new URL('../cases.json', import.meta.url), 'utf8'));
async function fixture(id) {
  return (await readFile(new URL(`../${id}-session.jsonl`, import.meta.url), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
}
function result(events) { return events.find(e => e.type === 'tool/result' && e.data.message.content[0]?.content[0]?.text?.startsWith('Matching meme templates:')); }
const spec = cases[0];
test('saved suites have both valid behavior outputs and actual candidate counts', async () => {
  for (const specification of cases) {
    const outcome = evaluateToolResults(await fixture(specification.id), specification);
    assert.equal(outcome.passed, true);
    assert.ok(outcome.artifactCount > 0);
    assert.ok(outcome.checks.every(check => check.resultSeq > check.callSeq));
  }
});
test('missing, mismatched, duplicate and out-of-order results cannot pass', async () => {
  for (const mutate of [
    (events, item) => events.splice(events.indexOf(item), 1),
    (_, item) => { item.data.message.source.callId = 'unrelated'; },
    (_, item) => { item.data.message.content[0].toolCallId = 'unrelated'; },
    (events, item) => events.push(structuredClone(item)),
    (_, item) => { item.seq = 1; },
  ]) {
    const events = await fixture('E1'); mutate(events, result(events));
    assert.equal(evaluateToolResults(events, spec).passed, false);
  }
});
test('execution errors and missing explicit success are distinguished', async () => {
  for (const flag of [true, undefined]) {
    const events = await fixture('E1'); result(events).data.message.content[0].isError = flag;
    const outcome = evaluateToolResults(events, spec);
    assert.equal(outcome.passed, false);
    assert.equal(outcome.checks[0].status, flag ? 'ERROR' : 'INVALID');
  }
});
test('one malformed candidate invalidates a partially usable result', async () => {
  const events = await fixture('E1');
  const text = result(events).data.message.content[0].content[0];
  text.text += '\n### Broken candidate\nTemplate ID: `broken`\nKeywords: none\n';
  assert.equal(evaluateToolResults(events, spec).checks[0].status, 'INVALID');
});
test('empty search is successful but does not satisfy required artifact; later recovery can', async () => {
  const events = await fixture('E1');
  const item = result(events); const original = structuredClone(item);
  item.data.message.content[0].content[0].text = 'No matching meme templates were found.';
  let outcome = evaluateToolResults(events, spec);
  assert.equal(outcome.checks[0].status, 'EMPTY'); assert.equal(outcome.passed, false);
  const call = structuredClone(events.find(e => e.type === 'tool/call' && e.data.name === 'search_memes'));
  call.data.callId = 'retry'; call.seq = 100;
  original.data.message.source.callId = 'retry'; original.data.message.content[0].toolCallId = 'retry'; original.seq = 101;
  outcome = evaluateToolResults([...events, call, original], spec);
  assert.equal(outcome.passed, true);
});
test('URLs and generated image consistency are validated without fetching', async () => {
  for (const replacement of ['javascript:alert(1)', 'https://user:password@example.com/image.png']) {
    const events = await fixture('E1');
    const text = result(events).data.message.content[0].content[0];
    text.text = text.text.replace(/https:\/\/api.memegen.link\/images\/fine.jpg/g, replacement);
    assert.equal(evaluateToolResults(events, spec).passed, false);
  }
  const events = await fixture('E3');
  const item = events.find(e => e.type === 'tool/result' && e.data.message.content[0]?.content[0]?.text?.startsWith('Generated meme:'));
  item.data.message.content[0].content[0].text = item.data.message.content[0].content[0].text.replace('Image URL: https://api.memegen.link', 'Image URL: https://other.example');
  assert.equal(evaluateToolResults(events, cases[2]).passed, false);
});
test('no business output is N/A only when the case does not require it', () => {
  assert.equal(evaluateToolResults([], cases[3]).applicable, false);
  assert.equal(evaluateToolResults([], spec).passed, false);
});
test('GIF results require both preview and GIF URLs', async () => {
  const events = await fixture('E2');
  const item = events.find(e => e.type === 'tool/result' && e.data.message.content[0]?.content[0]?.text?.startsWith('Matching GIPHY reactions:'));
  item.data.message.content[0].content[0].text = item.data.message.content[0].content[0].text.replace(/^GIF URL: .*\n/m, '');
  assert.equal(evaluateToolResults(events, cases[1]).passed, false);
});
test('CLI keeps behavior and result verdicts separate and fails on output errors', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'my-meme-result-test-'));
  try {
    const events = await fixture('E1'); result(events).data.message.content[0].isError = true;
    const file = join(directory, 'error.jsonl');
    await writeFile(file, events.map(event => JSON.stringify(event)).join('\n'));
    const run = spawnSync(process.execPath, [new URL('../behavior-evaluator.mjs', import.meta.url).pathname, `E1=${file}`], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /E1 PASS —/);
    assert.match(run.stdout, /E1 RESULTS FAIL —/);
    assert.match(run.stdout, /Tool results: 0\/1 applicable cases passed/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
