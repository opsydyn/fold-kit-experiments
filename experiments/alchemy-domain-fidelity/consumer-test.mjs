import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'zloz-domain-consumer-'));
const manifest = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
const dependencies = {
  ...manifest.dependencies,
  '@opsydyn/foldkit-zloz':
    'file:' + resolve('../../packages/foldkit-zloz/dist/pack/opsydyn-foldkit-zloz-0.3.0.tgz'),
};
// oxlint-disable-next-line linteffect/no-try-catch -- Isolated test owns the temporary consumer and removes only that newly created directory on every outcome.
try {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies,
      devDependencies: manifest.devDependencies,
    }),
  );
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: dir,
    stdio: 'pipe',
  });
  assert.equal(existsSync(join(dir, 'node_modules/foldkit')), false);
  assert.equal(existsSync(join(dir, 'node_modules/react')), false);
  cpSync(new URL('dist/', import.meta.url), join(dir, 'dist'), { recursive: true });
  writeFileSync(
    join(dir, 'consumer.ts'),
    `import {extractDeclarations,mapDeclarations} from './dist/index.js';
import {Bank,calls} from './dist/fixture.js';
const result=mapDeclarations(extractDeclarations(Bank,{namespace:'consumer',revision:'v1'}));
if(result.type!=='mapped'||result.graph.nodes.length!==8||result.graph.edges.length!==8||calls()!==0)throw new Error('Isolated consumer failed');
console.log(JSON.stringify({nodes:result.graph.nodes.length,edges:result.graph.edges.length,handlers:calls()}));`,
  );
  const common = [
    'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    '--strict',
    '--exactOptionalPropertyTypes',
    '--skipLibCheck',
    '--target',
    'ES2022',
    'consumer.ts',
  ];
  execFileSync(
    'node',
    [...common, '--noEmit', '--module', 'ESNext', '--moduleResolution', 'Bundler'],
    { cwd: dir, stdio: 'pipe' },
  );
  execFileSync('node', [...common, '--module', 'NodeNext'], { cwd: dir, stdio: 'pipe' });
  const outcomes = [];
  for (const runtime of ['node', 'bun']) {
    const actual = JSON.parse(
      execFileSync(runtime, ['consumer.js'], { cwd: dir, encoding: 'utf8' }),
    );
    assert.deepEqual(actual, { nodes: 8, edges: 8, handlers: 0 });
    outcomes.push({ runtime, ...actual });
  }
  writeFileSync(
    new URL('evidence/isolated-consumer.json', import.meta.url),
    JSON.stringify(
      {
        profiles: ['NodeNext', 'Bundler'],
        outcomes,
        foldkitInstalled: false,
        reactInstalled: false,
        usesMonorepoNodeModules: false,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(outcomes));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
