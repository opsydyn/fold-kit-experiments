import { DatasetId, datasetIds, datasets } from '@opsydyn/dataset-explorer/data';
import type { APIRoute, GetStaticPaths } from 'astro';
import { Schema } from 'effect';

export const getStaticPaths: GetStaticPaths = () =>
  datasetIds.map((dataset) => ({ params: { dataset } }));
export const GET: APIRoute = ({ params }) => {
  const dataset = Schema.decodeUnknownSync(DatasetId)(params.dataset);
  return Response.json({
    dataset,
    points: datasets[dataset].values.map((value, index) => ({ hour: index * 2, value })),
  });
};
