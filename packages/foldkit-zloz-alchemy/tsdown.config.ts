import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    domain: 'src/domain.ts',
    collaboration: 'src/collaboration.ts',
    assessment: 'src/assessment.ts',
    checkpoint: 'src/checkpoint.ts',
    delta: 'src/delta.ts',
    hash: 'src/hash.ts',
    session: 'src/session.ts',
  },
  // The pinned Domain SDK's aggregate types model omitted reads as undefined.
  // The portable read-only entry retains its separate strict typecheck.
  tsconfig: 'tsconfig.collaboration.json',
  dts: true,
  format: 'esm',
  outDir: 'dist',
  clean: true,
  target: 'es2022',
  sourcemap: true,
});
