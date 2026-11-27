import { expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { SourceName } from '@opsydyn/dataset-explorer/source';
import { Schema } from 'effect';
import { chromium } from 'playwright';

import { projectFiles as histogramFiles } from '../src/examples/histogram/project';
import { projectFiles as scatterFiles } from '../src/examples/scatter/project';
import { buildExampleTemplate } from '../src/lib/example-project';
import type { SourceFile } from '../src/lib/example-project';
import { verifyDatasetSwitch } from './dataset-browser-scenario';

const exec = promisify(execFile);
const examplesRoot = fileURLToPath(new URL('../src/examples/', import.meta.url));
async function maintainedSources(example: string): Promise<ReadonlyArray<SourceFile>> {
  if (example === 'datasets') {
    const root = fileURLToPath(new URL('../../../packages/dataset-explorer/src/', import.meta.url));
    return Promise.all(
      (await readdir(root))
        .filter((name) => Schema.is(SourceName)(name))
        .map(async (name) => ({
          name,
          content: await readFile(join(root, name), 'utf8'),
        })),
    );
  }
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

for (const example of ['line', 'histogram', 'scatter', 'datasets'] as const) {
  test(`${example} exported project installs, typechecks and builds outside the workspace`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `foldkit-standalone-${example}-`));
    try {
      const template = await buildExampleTemplate(await maintainedSources(example), example);
      const files =
        example === 'histogram'
          ? histogramFiles(template, { dataset: 'clustered', binCount: 11 })
          : example === 'scatter'
            ? scatterFiles(template, { group: 'b', xMax: 170, yMax: 150, selectedPoint: 'b-03' })
            : template;
      if (example === 'datasets' || example === 'histogram' || example === 'scatter') {
        expect(template['package.json']).toContain('"@effect/ui"');
        expect(template['package.json']).not.toContain('"foldkit"');
        expect(template['src/entry.ts']).toContain('BrowserHost');
      }
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
          example === 'datasets' || example === 'scatter'
            ? "import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian'; import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme'; import { symbolPath } from '@opsydyn/foldkit-viz/shape/symbol'; console.log(typeof lineGeometry, lightTheme.labelSize, typeof symbolPath);"
            : example === 'histogram'
              ? "import { histogramGeometry } from '@opsydyn/foldkit-viz/chart/cartesian'; import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme'; import { bin } from '@opsydyn/foldkit-viz/math/bin'; console.log(typeof histogramGeometry, lightTheme.labelSize, typeof bin);"
              : "import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian'; import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme'; import { chartFrame } from '@opsydyn/foldkit-viz/foldkit/cartesian'; console.log(typeof lineGeometry, lightTheme.labelSize, typeof chartFrame);",
        ],
        options,
      );
      expect(stdout.trim()).toBe('function 12 function');
      expect(await readdir(join(directory, 'dist'))).toContain('index.html');
      if (example === 'scatter' && process.env.SCATTER_BROWSER === '1') {
        const browser = await chromium.launch();
        try {
          const page = await browser.newPage();
          const origin = 'http://scatter-standalone.test';
          await page.route(origin + '/**', async (request) => {
            const path = new URL(request.request().url()).pathname.slice(1);
            await request.fulfill({ path: join(directory, 'dist', path || 'index.html') });
          });
          await page.goto(origin);
          const chart = page.getByRole('img', { name: /Illustrative scatter plot/ });
          await chart.waitFor();
          const picker = page.getByRole('combobox', { name: 'Inspect point' });
          expect(await picker.inputValue()).toBe('b-03');
          expect(await chart.locator('[data-symbol="square"]').count()).toBe(12);
          expect(await page.getByRole('slider', { name: /X domain maximum/ }).inputValue()).toBe(
            '170',
          );
          expect(await chart.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
            'http://www.w3.org/2000/svg',
          );
          await chart.press('ArrowRight');
          expect(await picker.inputValue()).toBe('b-04');
          expect(await page.getByRole('button', { name: 'Download project' }).count()).toBe(0);
        } finally {
          await browser.close();
        }
      }
      if (example === 'histogram' && process.env.HISTOGRAM_BROWSER === '1') {
        const browser = await chromium.launch();
        try {
          const page = await browser.newPage();
          const origin = 'http://histogram-standalone.test';
          await page.route(origin + '/**', async (request) => {
            const path = new URL(request.request().url()).pathname.slice(1);
            await request.fulfill({ path: join(directory, 'dist', path || 'index.html') });
          });
          await page.goto(origin);
          const slider = page.getByRole('slider', { name: /Number of bins/ });
          await slider.waitFor();
          expect(await slider.inputValue()).toBe('11');
          expect(
            await page.getByRole('button', { name: 'Clustered' }).getAttribute('aria-pressed'),
          ).toBe('true');
          const chart = page.getByRole('img', { name: /Illustrative histogram/ });
          expect(await chart.locator('.chart-bar-series rect').count()).toBe(11);
          expect(await chart.locator('desc').evaluate((node) => node.namespaceURI)).toBe(
            'http://www.w3.org/2000/svg',
          );
          await slider.press('ArrowRight');
          await chart.locator('.chart-bar-series rect').nth(11).waitFor({ state: 'attached' });
          expect(await page.getByRole('button', { name: 'Download project' }).count()).toBe(0);
        } finally {
          await browser.close();
        }
      }
      if (example === 'datasets' && process.env.DATASET_BROWSER === '1') {
        const browser = await chromium.launch();
        try {
          const page = await browser.newPage();
          const origin = 'http://dataset-standalone.test';
          await page.route(origin + '/**', async (request) => {
            const path = new URL(request.request().url()).pathname.slice(1);
            await request.fulfill({ path: join(directory, 'dist', path || 'index.html') });
          });
          await verifyDatasetSwitch(page, origin, (url) => url.pathname === '/datasets/coast.json');
        } finally {
          await browser.close();
        }
      }
      if (example === 'datasets') {
        for (const [station, first, last] of [
          ['north', 4, 8],
          ['coast', 8, 11],
          ['upland', 6, 13],
        ] as const) {
          const fixture = JSON.parse(
            await readFile(join(directory, 'dist/datasets', station + '.json'), 'utf8'),
          );
          expect(fixture.dataset).toBe(station);
          expect(fixture.points).toHaveLength(8);
          expect(fixture.points[0]).toEqual({ hour: 0, value: first });
          expect(fixture.points[7]).toEqual({ hour: 14, value: last });
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 240_000);
}
