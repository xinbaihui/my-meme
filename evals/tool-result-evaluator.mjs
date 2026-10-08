// Offline validation of the rendered result format emitted by plugin/src/meme-plugin.ts.
export const CONTENT_TOOLS = new Set(['search_memes', 'search_giphy', 'generate_meme']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function webUrl(value) {
  if (!nonempty(value) || /\s/.test(value)) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
function artifacts(name, text) {
  const empty = name === 'search_memes' ? 'No matching meme templates were found.' : 'GIPHY returned no matching reaction GIFs or stickers.';
  if (name !== 'generate_meme' && text.trim() === empty) return { status: 'EMPTY', artifactCount: 0, reason: 'Successful empty search; no usable artifact.' };
  if (name === 'generate_meme') {
    const id = text.match(/^Template ID: `([^`]+)`$/m)?.[1];
    const caption = text.match(/^Caption: (.+)$/m)?.[1];
    const image = text.match(/^!\[Generated meme\]\(([^\n]+)\)$/m)?.[1];
    const url = text.match(/^Image URL: (\S+)$/m)?.[1];
    const valid = text.startsWith('Generated meme:\n') && nonempty(id) && nonempty(caption) && caption.split(" / ").some(nonempty) && webUrl(url) && image === url;
    return { status: valid ? 'VALID' : 'INVALID', artifactCount: valid ? 1 : 0,
      reason: valid ? 'Template ID, caption and matching HTTP(S) image links present.' : 'Missing or invalid template ID, caption or matching image links.' };
  }
  const heading = name === 'search_memes' ? 'Matching meme templates:' : 'Matching GIPHY reactions:';
  const blocks = text.split(/^### /m).slice(1);
  const valid = text.startsWith(heading + '\n') && blocks.length > 0 && blocks.every(block => {
    const title = block.split('\n')[0];
    const id = block.match(name === 'search_memes' ? /^Template ID: `([^`]+)`$/m : /^ID: `([^`]+)`$/m)?.[1];
    const preview = block.match(/^!\[[^\n]*\]\(([^\n]+)\)$/m)?.[1];
    if (!nonempty(title) || !nonempty(id) || !webUrl(preview)) return false;
    return name === 'search_memes' ? /^Keywords: .+$/m.test(block) : webUrl(block.match(/^GIF URL: (\S+)$/m)?.[1]);
  });
  return { status: valid ? 'VALID' : 'INVALID', artifactCount: valid ? blocks.length : 0,
    reason: valid ? `All ${blocks.length} candidates contain the required ID, title and HTTP(S) image fields.` : 'Malformed candidate or missing required ID, title, image or metadata fields.' };
}

export function evaluateToolResults(events, specification = {}) {
  const calls = events.filter(event => event.type === 'tool/call' && CONTENT_TOOLS.has(event.data?.name));
  const checks = calls.map(call => {
    const base = { tool: call.data.name, callSeq: call.seq, turn: call.data.turn, resultSeq: null, artifactCount: 0 };
    const id = call.data.callId;
    if (!nonempty(id) || events.filter(e => e.type === 'tool/call' && e.data?.callId === id).length !== 1)
      return { ...base, status: 'INVALID', reason: 'Missing or duplicate tool call identifier.' };
    const results = events.filter(event => event.type === 'tool/result' && event.data?.message?.source?.callId === id);
    if (results.length === 0) return { ...base, status: 'MISSING', reason: 'No result linked to this call identifier.' };
    if (results.length !== 1) return { ...base, status: 'INVALID', reason: 'Multiple results linked to one call.' };
    const result = results[0];
    const linked = { ...base, resultSeq: result.seq };
    if (!Number.isSafeInteger(result.seq) || result.seq <= call.seq || result.data.turn !== call.data.turn)
      return { ...linked, status: 'INVALID', reason: 'Result precedes its call or belongs to a different turn.' };
    const envelopes = result.data.message.content;
    if (!Array.isArray(envelopes) || envelopes.length !== 1 || envelopes[0]?.type !== 'tool-result' || envelopes[0].toolCallId !== id)
      return { ...linked, status: 'INVALID', reason: 'Result envelope does not identify the matching call.' };
    const envelope = envelopes[0];
    if (envelope.isError === true) return { ...linked, status: 'ERROR', reason: 'Tool reported an execution error.' };
    if (envelope.isError !== false || !Array.isArray(envelope.content) || envelope.content.length !== 1 || envelope.content[0]?.type !== 'text' || typeof envelope.content[0].text !== 'string')
      return { ...linked, status: 'INVALID', reason: 'Missing explicit success flag or supported rendered text payload.' };
    return { ...linked, ...artifacts(call.data.name, envelope.content[0].text.replace(/\r\n/g, '\n')) };
  });
  // Apply artifact expectations to the same tools/turns specified by the behavior cases.
  const expectations = [
    ...(specification.requiredTools ?? []).filter(tool => CONTENT_TOOLS.has(tool)).map(tool => ({ tool })),
    ...(specification.requiredToolsInTurn ?? []).flatMap(rule => rule.tools.filter(tool => CONTENT_TOOLS.has(tool)).map(tool => ({ tool, turn: rule.turn }))),
  ];
  const failures = checks.filter(check => !['VALID', 'EMPTY'].includes(check.status)).map(check => `${check.tool} at seq ${check.callSeq}: ${check.reason}`);
  for (const expected of expectations) {
    if (!checks.some(check => check.tool === expected.tool && (expected.turn === undefined || check.turn === expected.turn) && check.status === 'VALID'))
      failures.push(`No usable artifact from required ${expected.tool}${expected.turn === undefined ? '' : ` in turn ${expected.turn}`}.`);
  }
  const applicable = checks.length > 0 || expectations.length > 0;
  return { applicable, passed: failures.length === 0, artifactCount: checks.reduce((sum, check) => sum + check.artifactCount, 0), checks,
    reason: failures.length ? failures.join('; ') : applicable ? 'All business-tool calls have successful, structurally valid results; required routes produced artifacts.' : 'No business-tool output required or called; not applicable.' };
}
