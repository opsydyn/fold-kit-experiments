import { Schema } from 'effect';

import { SourceName } from '../examples/line/source';

const files = import.meta.glob<string>('../examples/line/*.{ts,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
export const lineSources = Object.entries(files)
  .filter(([path]) => !path.endsWith('/app.ts'))
  .map(([path, content]) => ({
    name: Schema.decodeUnknownSync(SourceName)(path.split('/').at(-1)),
    content,
  }));
