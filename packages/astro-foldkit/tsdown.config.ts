import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    server: 'src/server.ts',
    'server-render': 'src/server-render.ts',
    'build-id': 'src/build-id.ts',
    'server-public': 'src/server-public.ts',
    'define-app': 'src/define-app.ts',
    'define-page': 'src/define-page.ts',
  },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  deps: {
    neverBundle: ['astro', 'foldkit'],
  },
});
