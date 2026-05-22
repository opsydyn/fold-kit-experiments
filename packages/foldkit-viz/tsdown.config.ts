import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'math/scale': 'src/math/scale.ts',
    'math/color': 'src/math/color.ts',
    'math/stats': 'src/math/stats.ts',
    simulation: 'src/simulation/index.ts',
    'shape/path': 'src/shape/path.ts',
    'shape/arc': 'src/shape/arc.ts',
    'shape/area': 'src/shape/area.ts',
    'shape/line': 'src/shape/line.ts',
    'shape/pie': 'src/shape/pie.ts',
    'shape/lineRadial': 'src/shape/lineRadial.ts',
    'shape/stack': 'src/shape/stack.ts',
    'shape/chord': 'src/shape/chord.ts',
    'shape/sankey': 'src/shape/sankey.ts',
    hierarchy: 'src/hierarchy/index.ts',
  },
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
});
