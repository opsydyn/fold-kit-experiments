import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildExampleTemplate } from '../src/lib/example-project';
import type { SourceFile } from '../src/lib/example-project';

const exec = promisify(execFile);
const examplesRoot = fileURLToPath(new URL('../src/examples/', import.meta.url));
async function maintainedSources(example: string): Promise<ReadonlyArray<SourceFile>> {
  const sources: Array<SourceFile> = [];
  for (const folder of [example, 'shared']) {
    for (const name of await readdir(join(examplesRoot, folder))) {
      if (name === 'app.ts' || !/\.(ts|css)$/.test(name)) continue;
      sources.push({
        name: folder === 'shared' ? 'shared/' + name : name,
        content: await readFile(join(examplesRoot, folder, name), 'utf8'),
      });
    }
  }
  return sources;
}

for (const example of ['line', 'histogram', 'scatter'] as const) {
  test(`${example} exported project installs, typechecks and builds outside the workspace`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `foldkit-standalone-${example}-`));
    try {
      const files = await buildExampleTemplate(await maintainedSources(example), example);
      for (const [name, contents] of Object.entries(files)) {
        const file = join(directory, name);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, contents);
      }
      const options = { cwd: directory, maxBuffer: 4 * 1024 * 1024, timeout: 180_000 };
      await exec('npm', ['install', '--no-audit', '--no-fund'], options);
      await exec('npm', ['run', 'typecheck'], options);
      await exec('npm', ['run', 'build'], options);
      const { stdout } = await exec(
        'node',
        [
          '--input-type=module',
          '-e',
          `import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian'; import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme'; import { chartFrame } from '@opsydyn/foldkit-viz/foldkit/cartesian'; console.log(typeof lineGeometry, lightTheme.labelSize, typeof chartFrame);`,
        ],
        options,
      );
      expect(stdout.trim()).toBe('function 12 function');
      expect(await readdir(join(directory, 'dist'))).toContain('index.html');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 240_000);
}
