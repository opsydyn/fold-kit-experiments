// The external npm project is a disposable filesystem fixture.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { projectFiles } from '../src/examples/comparison/project';
import { collectComparisonSources } from '../src/lib/comparison-sources';
import { buildExampleTemplate } from '../src/lib/example-project';

const exec = promisify(execFile);
test('comparison standalone installs, typechecks and builds with captured structure outside the monorepo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'foldkit-comparison-test-'));
  try {
    const files = projectFiles(
      await buildExampleTemplate(await collectComparisonSources(), 'comparison'),
      {
        panels: [
          { id: 2, kind: 'histogram' },
          { id: 3, kind: 'scatter' },
          { id: 1, kind: 'scatter' },
        ],
        linkInspections: false,
        nextPanelId: 4,
      },
    );
    expect(files['package.json']).not.toContain('workspace:');
    expect(files['package.json']).not.toContain('#example/');
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(directory, name)), { recursive: true });
      await writeFile(join(directory, name), content);
    }
    const options = { cwd: directory, maxBuffer: 4 * 1024 * 1024, timeout: 180_000 };
    await exec('npm', ['install', '--no-audit', '--no-fund'], options);
    await exec('npm', ['run', 'typecheck'], options);
    await exec('npm', ['run', 'build'], options);
    expect(await readdir(join(directory, 'dist'))).toContain('index.html');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 240_000);
