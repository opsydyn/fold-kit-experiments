import favicon from '../../../../docs/assets/zloz/final/favicon.svg?raw';

export function GET(): Response {
  return new Response(favicon, { headers: { 'Content-Type': 'image/svg+xml' } });
}
