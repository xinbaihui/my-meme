import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'vite';

let App;

before(async () => {
  await build({ build: { ssr: 'src/App.tsx', outDir: '.test-dist', emptyOutDir: true }, logLevel: 'silent' });
  ({ default: App } = await import('../.test-dist/App.js'));
});

async function render() {
  return renderToStaticMarkup(createElement(App));
}

test('evaluations render as the homepage without a backend', async () => {
  const html = await render();
  assert.match(html, /href="\/" aria-current="page">Evaluations/);
  assert.doesNotMatch(html, /Overview|What I built/);
  assert.match(html, /href="https:\/\/121\.40\.130\.20\/demo"/);
  assert.doesNotMatch(html, /[?&]token=/);
  assert.doesNotMatch(html, /View evaluations|The right/);
  assert.doesNotMatch(html, /id="meme-prompt"|chat-composer|Find Memes →/);
});

test('evaluation page identifies the sample and displays recorded E5 call order', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../public/evaluations/snapshot.json', import.meta.url), 'utf8'));
  const html = await render();
  assert.match(html, /class="score-ring">100%/);
  assert.doesNotMatch(html, /score-card|ONE SUITE SAMPLE/);
  assert.doesNotMatch(html, /TRAJECTORY START|SNAPSHOT EXPORTED|ORIGINAL RUN CODE VERSION|Download evidence snapshot/);
  const e5 = snapshot.cases.find(item => item.id === 'E5');
  for (const call of e5.calls) assert.ok(html.includes(`seq ${call.seq} · T${call.turn}`));
  assert.doesNotMatch(html, /E5 repeated runs|9\/10 across two later samples/);
  assert.match(html, /Tool result verdict/);
  assert.match(html, /100%/);
  assert.match(html, /Behavior · 5 \/ 5 passed/);
  assert.match(html, /Tool results · 5 \/ 5 passed/);
  assert.match(html, /One recorded evaluation run · 5 cases/);
  assert.doesNotMatch(html, /result-summary/);
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
