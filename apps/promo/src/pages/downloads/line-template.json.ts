import type { APIRoute } from 'astro';

import { buildLineTemplate } from '../../lib/line-project';
import { lineSources } from '../../lib/line-sources';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildLineTemplate(lineSources)), {
    headers: { 'Content-Type': 'application/json' },
  });
