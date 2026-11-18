import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async ({ url }, next) => {
  const response = await next();
  if (url.pathname.startsWith('/api/')) return response;
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
