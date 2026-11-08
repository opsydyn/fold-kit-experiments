import { mermaidBundle } from '../../lib/context-model';

export function GET(): Response {
  return new Response(JSON.stringify(mermaidBundle, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
