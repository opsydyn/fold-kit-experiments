import { serializeGraph } from '@opsydyn/foldkit-zloz';

import { contextGraph } from '../../lib/context-model';

export function GET(): Response {
  return new Response(serializeGraph(contextGraph), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
