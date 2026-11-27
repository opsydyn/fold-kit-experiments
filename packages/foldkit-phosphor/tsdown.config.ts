import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: { index: 'src/index.ts', compile: 'src/compile.ts', 'effect-ui': 'src/effect-ui.ts' },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
});
