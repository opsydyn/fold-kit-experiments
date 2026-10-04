import { Schema } from 'effect';

import { SourceName } from '../examples/histogram/source';

const files = import.meta.glob<string>('../examples/histogram/*.{ts,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export const histogramSources = Object.entries(files)
  .filter(([path]) => !path.endsWith('/app.ts'))
  .map(([path, content]) => ({
    name: Schema.decodeUnknownSync(SourceName)(path.split('/').at(-1)),
    content,
  }));
