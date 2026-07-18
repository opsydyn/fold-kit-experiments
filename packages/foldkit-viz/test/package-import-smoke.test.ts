import { afterAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 10 * 1024 * 1024;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type SmokeFixture = {
  runtimeOutput: string;
};

const tempDir: { path: string | undefined } = { path: undefined };
const tarball: { path: string | undefined } = { path: undefined };

const setupFixture = async (): Promise<SmokeFixture> => {
  const artifactsDir = path.join(packageDir, 'artifacts', 'test');
  await mkdir(artifactsDir, { recursive: true });
  tempDir.path = await mkdtemp(path.join(artifactsDir, 'selection-smoke-'));
  const unpackDir = path.join(tempDir.path, 'unpack');
  const consumerDir = path.join(tempDir.path, 'consumer');
  const packageScopeDir = path.join(consumerDir, 'node_modules', '@opsydyn');

  await execFileAsync('bun', ['run', 'build'], { cwd: packageDir, maxBuffer });
  const { stdout } = await execFileAsync(
    'npm',
    ['pack', '--json', '--pack-destination', tempDir.path],
    {
      cwd: packageDir,
      maxBuffer,
    },
  );
  const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
  tarball.path = path.join(tempDir.path, filename);

  await mkdir(unpackDir, { recursive: true });
  await mkdir(packageScopeDir, { recursive: true });
  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'foldkit-viz-selection-smoke', private: true, type: 'module' }),
  );
  await execFileAsync('tar', ['-xzf', tarball.path, '-C', unpackDir], { maxBuffer });
  await rename(path.join(unpackDir, 'package'), path.join(packageScopeDir, 'foldkit-viz'));

  const consumer = path.join(consumerDir, 'selection-consumer.ts');
  await writeFile(
    consumer,
    `import { intervalSelection as intervalSelectionFromRoot } from '@opsydyn/foldkit-viz';
import { intervalSelection as intervalSelectionFromSelection } from '@opsydyn/foldkit-viz/interaction/selection';

const rootSelection = intervalSelectionFromRoot('x', [0, 1]);
const selectionSelection = intervalSelectionFromSelection('x', [0, 1]);
void rootSelection;
void selectionSelection;
`,
  );
  await execFileAsync(
    'bun',
    [
      'x',
      'tsc',
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      consumer,
    ],
    { cwd: consumerDir, maxBuffer },
  );
  const { stdout: runtimeOutput } = await execFileAsync(
    'bun',
    [
      '-e',
      "Promise.all([import('@opsydyn/foldkit-viz'), import('@opsydyn/foldkit-viz/interaction/selection')]).then(([root, selection]) => console.log([root.intervalSelection('x', [0, 1])._tag, selection.intervalSelection('x', [0, 1])._tag].join('\\n')))",
    ],
    { cwd: consumerDir, maxBuffer },
  );

  return { runtimeOutput };
};

const fixturePromise = setupFixture();

afterAll(async () => {
  const tempDirCleanup =
    tempDir.path === undefined ? [] : [rm(tempDir.path, { recursive: true, force: true })];
  const tarballCleanup = tarball.path === undefined ? [] : [rm(tarball.path, { force: true })];
  await Promise.all([...tempDirCleanup, ...tarballCleanup]);
});

describe('packed selection import', () => {
  it('resolves at runtime and in TypeScript for a consumer', async () => {
    const { runtimeOutput } = await fixturePromise;
    expect(runtimeOutput.trim()).toBe('Interval\nInterval');
  }, 60_000);
});
