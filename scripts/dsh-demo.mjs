// A loopback-only entry for native DSH's process-specific startup credential.
export function startupUrl(line) {
  const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
  const match = clean.match(/^dsh web:\s+(https?:\/\/\S+)/);
  if (!match) return undefined;
  try {
    const url = new URL(match[1]);
    if (['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '3080'
      && !url.username && !url.password && url.pathname === '/'
      && url.searchParams.getAll('token').length === 1 && url.searchParams.get('token')?.trim()) return url.href;
  } catch { /* Ignore non-startup or unsupported output without exposing credentials. */ }
}

export function dshArguments(trustedHost = '') {
  const args = ['--yes', '@deepseek-ai/dsh', 'web', '--no-open', '--port', '3080'];
  const host = trustedHost.trim();
  if (!host) return args;
  if (!/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(host)) {
    throw new Error('DSH_TRUSTED_HOST must be a hostname or IP address, optionally followed by a port.');
  }
  return [...args, '--trusted-host', host];
}

export function demoHandler(getUrl) {
  return (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (!['127.0.0.1:3081', 'localhost:3081'].includes(request.headers.host)) {
      response.writeHead(403); response.end('Local demo access only.'); return;
    }
    if (request.url !== '/' || request.method !== 'GET') {
      response.writeHead(404); response.end('Not found.'); return;
    }
    const url = getUrl();
    if (!url) {
      response.setHeader('Retry-After', '2');
      response.writeHead(503); response.end('DSH is starting. Refresh this page in a moment.'); return;
    }
    response.writeHead(302, { Location: url }); response.end();
  };
}
