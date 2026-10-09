import { SourceName } from '@opsydyn/dataset-explorer/source';
import { Schema } from 'effect';

const files = import.meta.glob<string>('../../../../packages/dataset-explorer/src/*.{ts,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export const datasetSources = Object.entries(files).map(([path, content]) => ({
  name: Schema.decodeUnknownSync(SourceName)(path.split('/').at(-1)),
  content,
}));
