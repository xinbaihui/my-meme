import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function render(path) {
  const { default: worker } = await import('../dist/server/index.js');
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: 'text/html' } }),
    { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} });
}

test('portfolio renders without a backend and offers evaluation evidence', async () => {
  const response = await render('/');
  assert.equal(response.status, 200);
  const html = (await response.text()).replace(/<!--.*?-->/gs, "");
  assert.match(html, /What I built/);
  assert.match(html, /href="\/evals"/);
  assert.doesNotMatch(html, /View evaluations|The right/);
  assert.doesNotMatch(html, /id="meme-prompt"|chat-composer|Find Memes →/);
});

test('evaluation page identifies the sample and displays recorded E5 call order', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/evaluations/snapshot.json', import.meta.url), 'utf8'));
  const response = await render('/evals');
  assert.equal(response.status, 200);
  const html = (await response.text()).replace(/<!--.*?-->/gs, "");
  assert.match(html, /ONE SUITE SAMPLE/);
  assert.match(html, /Not recorded/);
  assert.match(html, /Download evidence snapshot/);
  const e5 = snapshot.cases.find(item => item.id === 'E5');
  for (const call of e5.calls) assert.ok(html.includes(`seq ${call.seq} · T${call.turn}`));
  assert.match(html, /not recomputed here/);
});

test('published snapshot reproduces source tool calls without raw payloads', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/evaluations/snapshot.json', import.meta.url), 'utf8'));
  assert.equal(snapshot.total, snapshot.cases.length);
  assert.equal(snapshot.passed, snapshot.cases.filter(item => item.result === 'PASS').length);
  for (const item of snapshot.cases) {
    const raw = await readFile(new URL(`../../${item.source}`, import.meta.url), 'utf8');
    const calls = raw.trim().split(/\r?\n/).map(line => JSON.parse(line)).filter(event => event.type === 'tool/call')
      .map(event => ({ name: event.data.name, seq: event.seq, turn: event.data.turn })).sort((a,b) => a.seq-b.seq);
    assert.deepEqual(item.calls, calls);
    assert.ok(item.recordedAt && !Number.isNaN(Date.parse(item.recordedAt)));
    for (const call of item.calls) assert.deepEqual(Object.keys(call).sort(), ['name','seq','turn']);
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
  }
});
