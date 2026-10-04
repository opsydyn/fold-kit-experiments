import type { APIRoute } from 'astro';

import { buildExampleTemplate } from '../../lib/example-project';
import { scatterSources } from '../../lib/scatter-sources';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildExampleTemplate(scatterSources, 'scatter')), {
    headers: { 'Content-Type': 'application/json' },
  });
