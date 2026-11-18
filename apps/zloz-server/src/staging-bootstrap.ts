/** Only the explicitly enabled staging origin exposes the existing bearer-protected task. */
export function stagingBootstrapRequest(
  request: Request,
  configuredOrigin: string,
  enabled: boolean,
): Request | null {
  if (
    !enabled ||
    configuredOrigin !== 'https://teams-staging.opsydyn.xyz' ||
    new URL(request.url).pathname !== '/api/zloz/operator/bootstrap' ||
    request.headers.get('origin') !== configuredOrigin
  )
    return null;
  const target = new URL('/internal/bootstrap', configuredOrigin);
  return new Request(target, request);
}
