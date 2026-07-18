import { describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxBuffer = 10 * 1024 * 1024;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('packed selection import', () => {
  it('resolves at runtime and in TypeScript for a consumer', async () => {
    const artifactsDir = path.join(packageDir, 'artifacts', 'test');
    await mkdir(artifactsDir, { recursive: true });
    const tempDir = await mkdtemp(path.join(artifactsDir, 'selection-smoke-'));
    const unpackDir = path.join(tempDir, 'unpack');
    const consumerDir = path.join(tempDir, 'consumer');
    const packageScopeDir = path.join(consumerDir, 'node_modules', '@opsydyn');
    let tarball: string | undefined;

    try {
      await execFileAsync('bun', ['run', 'build'], { cwd: packageDir, maxBuffer });
      const { stdout } = await execFileAsync('npm', ['pack', '--json'], {
        cwd: packageDir,
        maxBuffer,
      });
      const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
      tarball = path.join(packageDir, filename);

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
        `import { intervalSelection } from '@opsydyn/foldkit-viz/interaction/selection';

const selection = intervalSelection('x', [0, 1]);
void selection;
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
          "import('@opsydyn/foldkit-viz/interaction/selection').then(({ intervalSelection }) => console.log(intervalSelection('x', [0, 1])._tag))",
        ],
        { cwd: consumerDir, maxBuffer },
      );

      expect(runtimeOutput.trim()).toBe('Interval');
    } finally {
      if (tarball) await rm(tarball, { force: true });
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 60_000);
});
