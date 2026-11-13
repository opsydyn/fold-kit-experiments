import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: { index: 'src/index.ts', foldkit: 'src/foldkit.ts', browser: 'src/png-browser.ts' },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  sourcemap: true,
});
