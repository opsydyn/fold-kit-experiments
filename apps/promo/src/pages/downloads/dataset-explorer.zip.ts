import type { APIRoute } from 'astro';
import { strToU8, zipSync } from 'fflate';

import { datasetSources } from '../../lib/dataset-sources';
import { buildExampleTemplate } from '../../lib/example-project';

export const GET: APIRoute = async () => {
  const files = await buildExampleTemplate(datasetSources, 'datasets');
  const zip = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
  );
  return new Response(new Uint8Array(zip), { headers: { 'Content-Type': 'application/zip' } });
};
