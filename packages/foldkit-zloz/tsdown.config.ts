import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'effect-ui': 'src/effect-ui.ts',
    browser: 'src/png-browser.ts',
    coupling: 'src/coupling.ts',
  },
  copy: ['src/effect-ui.css', 'src/effect-ui.css.d.mts'],
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  sourcemap: true,
});
