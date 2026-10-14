import assert from 'node:assert/strict';
import test from 'node:test';
import { startupUrl, demoHandler, dshArguments } from '../dsh-demo.mjs';

test('DSH arguments add one optional trusted host', () => {
  assert.deepEqual(dshArguments(), ['--yes', '@deepseek-ai/dsh', 'web', '--no-open', '--port', '3080']);
  assert.deepEqual(dshArguments(' 121.40.130.20 '), ['--yes', '@deepseek-ai/dsh', 'web', '--no-open', '--port', '3080', '--trusted-host', '121.40.130.20']);
  assert.throws(() => dshArguments('https://example.com/path'), /DSH_TRUSTED_HOST/);
});
const launch = token => `http://127.0.0.1:3080/?token=${token}`;
function request(handler, overrides = {}) {
  const reply = { headers: {}, status: undefined, body: undefined,
    setHeader(key,value){this.headers[key]=value;}, writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);}, end(body){this.body=body;} };
  handler({ headers: {host:'127.0.0.1:3081'}, url:'/', method:'GET', ...overrides }, reply);
  return reply;
}
test('only native local startup announcements provide a token', () => {
  assert.equal(startupUrl(`dsh web: ${launch('test-one')}`), launch('test-one'));
  assert.equal(startupUrl(`\x1b[32mdsh web: ${launch('test-two')}\x1b[0m`), launch('test-two'));
  for (const line of [`Tool said ${launch('fake')}`, 'dsh web: http://127.0.0.1:3080/', 'dsh web: https://external.example/?token=fake', 'dsh web: http://127.0.0.1:3080/?token=a&token=b']) assert.equal(startupUrl(line), undefined);
});
test('fixed entry uses the latest startup credential, without caching', () => {
  let current;
  const handler = demoHandler(() => current);
  assert.equal(request(handler).status,503);
  current=launch('first-test-token');
  assert.equal(request(handler).headers.Location,current);
  current=launch('second-test-token');
  const reply=request(handler);
  assert.equal(reply.status,302); assert.equal(reply.headers.Location,current);
  assert.equal(reply.headers['Cache-Control'],'no-store');
  assert.equal(reply.headers['Referrer-Policy'],'no-referrer');
  current=undefined;
  assert.equal(request(handler).status,503);
});
test('bridge refuses foreign authorities, extra paths and methods', () => {
  const handler=demoHandler(()=>launch('test-token'));
  assert.equal(request(handler,{headers:{host:'foreign.example'}}).status,403);
  assert.equal(request(handler,{url:'/api'}).status,404);
  assert.equal(request(handler,{method:'POST'}).status,404);
});
