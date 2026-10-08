const configuredUrl = process.env.NEXT_PUBLIC_DSH_WEB_URL?.trim();

export function demoUrl(): string | undefined {
  if (!configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.searchParams.has('token') || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
