#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startupUrl, demoHandler, dshArguments } from './dsh-demo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let currentUrl;
let child;
let stopping = false;
const server = createServer(demoHandler(() => currentUrl));
server.on('error', error => {
  console.error(`Cannot start local demo entry (${error.code}). Check whether port 3081 is already in use.`);
  process.exitCode = 1;
});
server.listen(3081, '127.0.0.1', () => {
  console.log('My Meme demo entry: http://127.0.0.1:3081/');
  child = spawn('npx', dshArguments(process.env.DSH_TRUSTED_HOST), {
    cwd: root, env: { ...process.env, npm_config_cache: `${root}.npm-cache` },
    detached: process.platform !== 'win32', stdio: ['inherit', 'pipe', 'pipe'],
  });
  const monitor = (stream, output) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      output.write(chunk);
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const found = startupUrl(buffer.slice(0, end));
        if (found) currentUrl = found;
        buffer = buffer.slice(end + 1);
      }
      // Limit retained diagnostic output; no credentials are written to disk.
      if (buffer.length > 65536) buffer = buffer.slice(-65536);
    });
    stream.on('end', () => { const found = startupUrl(buffer); if (found) currentUrl = found; });
  };
  monitor(child.stdout, process.stdout);
  monitor(child.stderr, process.stderr);
  child.on('error', error => {
    currentUrl = undefined;
    console.error(`Cannot launch DSH (${error.code}).`);
    server.close(); process.exitCode = 1;
  });
  child.on('exit', code => {
    currentUrl = undefined; server.close();
    if (!stopping) process.exitCode = code ?? 1;
  });
});
function stop(signal) {
  if (stopping) return;
  stopping = true; currentUrl = undefined; server.close();
  if (child?.pid) {
    try { process.platform === 'win32' ? child.kill(signal) : process.kill(-child.pid, signal); } catch { /* Child already exited. */ }
    const timer = setTimeout(() => {
      try { process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); } catch { /* Child already exited. */ }
    }, 5000);
    timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
