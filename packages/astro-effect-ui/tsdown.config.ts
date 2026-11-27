import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    component: 'src/component.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
    'directive-interaction': 'src/directive-interaction.ts',
  },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  deps: { neverBundle: ['astro', 'effect', '@effect/ui', '@effect/ui/html'] },
});
