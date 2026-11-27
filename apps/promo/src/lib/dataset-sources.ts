import { SourceName } from '@opsydyn/dataset-explorer/source';
import { Schema } from 'effect';

const files = import.meta.glob<string>('../../../../packages/dataset-explorer/src/*.{ts,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export const datasetSources = Object.entries(files).flatMap(([path, content]) => {
  const name = path.split('/').at(-1);
  return Schema.is(SourceName)(name) ? [{ name, content }] : [];
});
