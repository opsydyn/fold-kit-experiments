import type { APIRoute } from 'astro';

import { collectComparisonSources } from '../../lib/comparison-sources';
import { buildExampleTemplate } from '../../lib/example-project';

export const GET: APIRoute = async () =>
  new Response(
    JSON.stringify(await buildExampleTemplate(await collectComparisonSources(), 'comparison')),
    { headers: { 'Content-Type': 'application/json' } },
  );
