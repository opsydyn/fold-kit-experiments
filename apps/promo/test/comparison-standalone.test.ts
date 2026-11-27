// The external npm project is a disposable filesystem fixture.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { chromium } from 'playwright';

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
    expect(files['package.json']).not.toContain('catalog:');
    expect(files['package.json']).toContain('"@effect/ui"');
    expect(files['package.json']).not.toMatch(/"(?:foldkit|@foldkit\/vite-plugin)":/);
    expect(files['package.json']).not.toContain('#example/');
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(directory, name)), { recursive: true });
      await writeFile(join(directory, name), content);
    }
    const options = { cwd: directory, maxBuffer: 4 * 1024 * 1024, timeout: 180_000 };
    await exec('npm', ['install', '--no-audit', '--no-fund'], options);
    const lock = await readFile(join(directory, 'package-lock.json'), 'utf8');
    expect(lock).not.toMatch(/node_modules\/(?:foldkit|@foldkit\/vite-plugin)"/);
    await exec('npm', ['run', 'typecheck'], options);
    await exec('npm', ['run', 'build'], options);
    const dist = join(directory, 'dist');
    expect(await readdir(dist)).toContain('index.html');
    if (process.env.COMPARISON_BROWSER === '1') await runStandalone(dist);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 240_000);

async function runStandalone(dist: string) {
  const browser = await chromium.launch();
  const origin = 'http://comparison-starter.test';
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin === origin
        ? route.fulfill({ path: join(dist, url.pathname === '/' ? 'index.html' : url.pathname) })
        : route.abort();
    });
    await page.goto(origin);
    const add = page.getByRole('button', { name: 'Add histogram' });
    await add.waitFor();
    const headings = page.locator('.comparison-panel h2');
    expect(await headings.allTextContents()).toEqual(['Histogram 2', 'Scatter 3', 'Scatter 1']);
    expect(await page.getByLabel('Link inspections').isChecked()).toBe(false);
    expect(await page.getByRole('button', { name: 'Download project' }).count()).toBe(0);
    await add.click();
    await page.getByRole('heading', { name: 'Histogram 4' }).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'comparison-panel-4');
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
}
