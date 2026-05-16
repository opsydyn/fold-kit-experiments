import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'math/scale': 'src/math/scale.ts',
    'shape/path': 'src/shape/path.ts',
    'shape/arc': 'src/shape/arc.ts',
    'shape/line': 'src/shape/line.ts',
    'shape/pie': 'src/shape/pie.ts',
  },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
});
