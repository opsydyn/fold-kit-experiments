import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: { index: 'src/index.ts', 'effect-ui': 'src/effect-ui.ts' },
  deps: { neverBundle: [/^@effect\/ui(?:\/|$)/] },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  sourcemap: true,
});
