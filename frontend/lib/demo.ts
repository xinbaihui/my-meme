const configuredUrl = process.env.NEXT_PUBLIC_DSH_WEB_URL?.trim();

export function demoUrl(): string | undefined {
  if (!configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
