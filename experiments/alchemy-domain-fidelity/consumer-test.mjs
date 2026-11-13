import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'zloz-domain-consumer-'));
const manifest = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
// oxlint-disable-next-line linteffect/no-try-catch -- Isolated test owns the temporary consumer and removes only that newly created directory on every outcome.
try {
  const coreArchive = resolve(
    '../../packages/foldkit-zloz/dist/pack/opsydyn-foldkit-zloz-0.3.0.tgz',
  );
  assert.equal(
    existsSync(coreArchive),
    true,
    'Repack the local core with pack:check immediately before this consumer qualification.',
  );
  const [packed] = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', dir], {
      encoding: 'utf8',
    }),
  );
  assert.equal(
    packed.files.some((file) => /fixture|test\//u.test(file.path)),
    false,
  );
  const dependencies = {
    ...manifest.dependencies,
    '@opsydyn/foldkit-zloz': 'file:' + coreArchive,
    [manifest.name]: 'file:' + join(dir, packed.filename),
  };
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies,
      devDependencies: { typescript: manifest.devDependencies.typescript },
    }),
  );
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: dir,
    stdio: 'pipe',
  });
  assert.equal(existsSync(join(dir, 'node_modules/foldkit')), false);
  assert.equal(existsSync(join(dir, 'node_modules/react')), false);
  const consumerLock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'));
  const expectedLock = JSON.parse(
    readFileSync(new URL('package-lock.json', import.meta.url), 'utf8'),
  );
  const coreIntegrity = consumerLock.packages['node_modules/@opsydyn/foldkit-zloz'].integrity;
  assert.equal(
    coreIntegrity,
    expectedLock.packages['node_modules/@opsydyn/foldkit-zloz'].integrity,
  );

  cpSync(new URL('dist/', import.meta.url), join(dir, 'dist'), { recursive: true });
  writeFileSync(
    join(dir, 'consumer.ts'),
    `import {projectAlchemyModel, type AlchemyProjectionOptions} from '@opsydyn/zloz-alchemy-domain-fidelity-spike';
import {Bank,calls} from './dist/fixture.js';
const options:AlchemyProjectionOptions={namespace:'consumer',revision:'v1',declaredPackageVersion:'2.0.0-beta.85'};
const result=projectAlchemyModel(Bank,options);
if(result.type!=='reviewable'||result.graph.nodes.length!==8||result.graph.edges.length!==8||calls()!==0)throw new Error('Installed adapter consumer failed');
console.log(JSON.stringify({nodes:result.graph.nodes.length,edges:result.graph.edges.length,handlers:calls(),readModels:result.nativeReadModels.length,feeds:result.nativeConsumption.length,losses:result.findings.filter(f=>f.severity==='loss').length}));`,
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
    assert.deepEqual(actual, {
      nodes: 8,
      edges: 8,
      handlers: 0,
      readModels: 1,
      feeds: 1,
      losses: 8,
    });
    outcomes.push({ runtime, ...actual });
  }
  writeFileSync(
    new URL('evidence/adapter-consumer.json', import.meta.url),
    JSON.stringify(
      {
        candidateIntegrity: packed.integrity,
        coreIntegrity,
        packageEntry: manifest.name,
        packedFixtureHandlers: false,
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
