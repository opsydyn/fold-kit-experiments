import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', component: 'src/component.ts' },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  deps: { neverBundle: ['@opsydyn/astro-effect-ui', '@opsydyn/astro-effect-ui/component'] },
});
