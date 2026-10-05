import type { APIRoute } from 'astro';

import { datasetSources } from '../../lib/dataset-sources';
import { buildExampleTemplate } from '../../lib/example-project';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildExampleTemplate(datasetSources, 'datasets')), {
    headers: { 'Content-Type': 'application/json' },
  });
