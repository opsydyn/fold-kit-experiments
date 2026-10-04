import { afterAll, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
  const tempDir = await mkdtemp(path.join(tmpdir(), 'foldkit-viz-smoke-'));

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
  // SAFETY: The chart algorithm establishes this representation before the assertion.
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
import { lineGeometry, scatterGeometry, histogramGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import type { ChartFrame } from '@opsydyn/foldkit-viz/chart/cartesian';
const frame: ChartFrame = { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const accessors = { x: (d: number) => d, y: (d: number) => d, datumKey: (d: number) => String(d), seriesKey: () => 'a' };
lineGeometry([0, 10], accessors, { frame });
scatterGeometry([0, 10], accessors, { frame });
histogramGeometry([0, 10], d => d, { frame, binCount: 2 });

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

  const geometryScript = `import { lineGeometry, scatterGeometry, histogramGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme';
const frame = { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
const accessors = { x: d => d, y: d => d, datumKey: d => String(d), seriesKey: () => 'a' };
console.log(lineGeometry([0, 10], accessors, { frame }).series[0].path);
console.log(scatterGeometry([5], accessors, { frame }).points[0].x);
console.log(histogramGeometry([0, 2, 5, 10], d => d, { frame, domain: [0, 10], binCount: 2 }).bins.map(b => b.count).join(','));
console.log(lightTheme.labelSize);`;
  for (const runtime of ['bun', 'node']) {
    const { stdout } = await execFileAsync(runtime, ['--input-type=module', '-e', geometryScript], {
      cwd: consumerDir,
      maxBuffer,
    });
    expect(stdout.trim()).toBe('M0,100L200,0\n100\n2,2\n12');
  }
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

it('does not install FoldKit or Effect when npm consumers only need the pure package', async () => {
  const fixture = await createFixture();
  const consumerDir = path.join(fixture.tempDir, 'npm-consumer');
  try {
    await mkdir(consumerDir, { recursive: true });
    await writeFile(
      path.join(consumerDir, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const tarball = await npmPack(fixture.tempDir);
    await execFileAsync(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball],
      { cwd: consumerDir, maxBuffer },
    );
    expect(existsSync(path.join(consumerDir, 'node_modules', 'foldkit'))).toBe(false);
    expect(existsSync(path.join(consumerDir, 'node_modules', 'effect'))).toBe(false);
  } finally {
    await fixture.cleanup();
  }
}, 120_000);

it('renders through the packed optional adapter with the installed FoldKit host', async () => {
  const fixture = await createFixture();
  const consumerDir = path.join(fixture.tempDir, 'adapter-consumer');
  try {
    await mkdir(consumerDir, { recursive: true });
    await writeFile(
      path.join(consumerDir, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    const tarball = await npmPack(fixture.tempDir);
    await execFileAsync(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
        'foldkit@0.165.0',
        'effect@4.0.0',
      ],
      { cwd: consumerDir, maxBuffer },
    );
    const script = `import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import { scatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import { darkTheme } from '@opsydyn/foldkit-viz/chart/theme';
import { chartFrame, pointSeries } from '@opsydyn/foldkit-viz/foldkit/cartesian';
const geometry = scatterGeometry([5], { x: d => d, y: d => d, datumKey: () => 'only', seriesKey: () => 'all' }, { frame: { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } } });
const result = await Effect.runPromise(renderToString({ Flags: Schema.Struct({ test: Schema.Boolean }), init: () => ({ model: 0 }), view: (_model, h) => ({ title: 'External host', body: chartFrame(h, { layout: geometry.layout, title: 'External chart', description: 'Singleton point', theme: darkTheme }, [pointSeries(h, { points: geometry.points, styleFor: () => darkTheme.series, labelFor: String, activeKey: null })]) }) }, { flags: { test: true }, isHydratable: false }));
console.log(result.html.includes('translate(100,50)') && result.html.includes('<title>External chart</title>'));`;
    for (const runtime of ['bun', 'node']) {
      const { stdout } = await execFileAsync(runtime, ['--input-type=module', '-e', script], {
        cwd: consumerDir,
        maxBuffer,
      });
      expect(stdout.trim()).toBe('true');
    }
  } finally {
    await fixture.cleanup();
  }
}, 120_000);
