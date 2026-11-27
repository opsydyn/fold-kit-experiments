import root from '../../../package.json';
import manifest from '../package.json';

const versions = root.workspaces.catalog;
const distribution = {
  name: manifest.name,
  version: manifest.version,
  private: true,
  description: 'Standalone Astro integration for Effect UI HTML components.',
  license: 'MIT',
  type: 'module',
  exports: {
    '.': { types: './index.d.mts', import: './index.mjs' },
    './component': { types: './component.d.mts', import: './component.mjs' },
  },
  dependencies: { '@effect/ui': versions['@effect/ui'] },
  peerDependencies: { astro: '>=5.0.0 <8', effect: '~4.1.0' },
  engines: { node: '>=22.0.0' },
};
await Bun.write(
  new URL('../dist/package.json', import.meta.url),
  JSON.stringify(distribution, null, 2) + '\n',
);
