import { afterAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 10 * 1024 * 1024;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Fixture = {
  readonly tempDir: string;
  readonly cleanup: () => Promise<void>;
};

type PackExecutor = (tempDir: string) => Promise<string>;

const createFixture = async (): Promise<Fixture> => {
  const artifactsDir = path.join(packageDir, 'artifacts', 'test');
  await mkdir(artifactsDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(artifactsDir, 'selection-smoke-'));

  return {
    tempDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};

const npmPack: PackExecutor = async (tempDir) => {
  const { stdout } = await execFileAsync('npm', ['pack', '--json', '--pack-destination', tempDir], {
    cwd: packageDir,
    maxBuffer,
  });
  const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
  return path.join(tempDir, filename);
};

const setupFixture = async (fixture: Fixture, pack: PackExecutor = npmPack): Promise<string> => {
  const unpackDir = path.join(fixture.tempDir, 'unpack');
  const consumerDir = path.join(fixture.tempDir, 'consumer');
  const packageScopeDir = path.join(consumerDir, 'node_modules', '@opsydyn');

  await execFileAsync('bun', ['run', 'build'], { cwd: packageDir, maxBuffer });
  const tarball = await pack(fixture.tempDir);

  await mkdir(unpackDir, { recursive: true });
  await mkdir(packageScopeDir, { recursive: true });
  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'foldkit-viz-selection-smoke', private: true, type: 'module' }),
  );
  await execFileAsync('tar', ['-xzf', tarball, '-C', unpackDir], { maxBuffer });
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

  return runtimeOutput;
};

const fixturePromise = createFixture();
const runtimeOutputPromise = fixturePromise.then((fixture) => setupFixture(fixture));

afterAll(async () => {
  const fixture = await fixturePromise;
  await fixture.cleanup();
});

describe('packed selection import', () => {
  it('resolves at runtime and in TypeScript for a consumer', async () => {
    const runtimeOutput = await runtimeOutputPromise;
    expect(runtimeOutput.trim()).toBe('Interval\nInterval');
  }, 60_000);

  it('cleans the fixture directory and tarball when npm pack fails', async () => {
    const fixture = await createFixture();
    const tarball = path.join(fixture.tempDir, 'failed-pack.tgz');
    const packFailure = new Error('injected npm pack failure');

    const failingPack: PackExecutor = async () => {
      await writeFile(tarball, 'partial tarball');
      throw packFailure;
    };

    await expect(setupFixture(fixture, failingPack)).rejects.toBe(packFailure);
    await fixture.cleanup();

    expect(existsSync(fixture.tempDir)).toBe(false);
    expect(existsSync(tarball)).toBe(false);
  }, 60_000);
});
