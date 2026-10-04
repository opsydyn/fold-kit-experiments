import type { APIRoute } from 'astro';

import { buildExampleTemplate } from '../../lib/example-project';
import { histogramSources } from '../../lib/histogram-sources';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildExampleTemplate(histogramSources, 'histogram')), {
    headers: { 'Content-Type': 'application/json' },
  });
