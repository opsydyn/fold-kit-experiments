import { Schema } from 'effect';

import { SourceName } from '../examples/scatter/source';

const files = import.meta.glob<string>('../examples/scatter/*.{ts,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const sharedFiles = import.meta.glob<string>('../examples/shared/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const localSources = Object.entries(files)
  .filter(([path]) => !path.endsWith('/app.ts'))
  .map(([path, content]) => ({
    name: Schema.decodeUnknownSync(SourceName)(path.split('/').at(-1)),
    content,
  }));
const sharedSources = Object.entries(sharedFiles).map(([path, content]) => ({
  name: Schema.decodeUnknownSync(SourceName)('shared/' + path.split('/').at(-1)),
  content,
}));
export const scatterSources = [...localSources, ...sharedSources];
