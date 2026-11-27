import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const core = resolve(
  fileURLToPath(new URL('../../../packages/foldkit-zloz/dist/', import.meta.url)),
);
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname;
  const base = route.startsWith('/__png/') ? core : root;
  const path = resolve(
    base,
    '.' + (route.startsWith('/__png/') ? route.slice(6) : route === '/' ? '/index.html' : route),
  );
  if (!path.startsWith(base + sep)) {
    response.writeHead(403).end();
    return;
  }
  await readFile(path).then(
    (body) => {
      response.setHeader(
        'Content-Type',
        /\.m?js$/u.test(path)
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      );
      response.end(body);
    },
    () => response.writeHead(404).end(),
  );
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
const browser = await chromium.launch();
async function run() {
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const file = (name) => fileURLToPath(new URL(name, import.meta.url));
  const section = (name) =>
    page
      .getByRole('navigation', { name: 'Workbench sections' })
      .getByRole('button', { name, exact: true })
      .click();
  const button = (name) => page.getByRole('button', { name, exact: true }).first();
  const acceptLosses = async (format) => {
    const acceptance = page.getByRole('checkbox', {
      name: `Accept the reported ${format} losses`,
      exact: true,
    });
    await acceptance.click();
    await expect(acceptance).toBeChecked();
  };
  const model = async () => {
    await section('History');
    const [d] = await Promise.all([
      page.waitForEvent('download'),
      button('Export model with lineage').click(),
    ]);
    return await readFile(await d.path(), 'utf8');
  };
  const download = async (action, name) => {
    const [d] = await Promise.all([page.waitForEvent('download'), action.click()]);
    const bytes = await readFile(await d.path());
    await writeFile(file(name), bytes);
    return bytes;
  };
  await page.goto(base);
  await button('Open workshop semantics example').click();
  const before = await model();
  for (const scheme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(scheme);
    await section('SVG export');
    await expect(button('Download SVG')).toBeDisabled();
    await expect(page.locator('[data-zloz-svg-review]')).toContainText('Custom badges');
    await acceptLosses('SVG');
    const svg = await download(button('Download SVG'), `workshop-export-${scheme}.svg`);
    expect(svg.toString()).toContain('Open question');
    expect(svg.toString()).toContain('Resolved');
    expect(svg.toString()).toContain(scheme === 'light' ? '#be123c' : '#fda4af');
    expect(svg.toString()).not.toContain('Discuss · open');
    await section('PNG export');
    await expect(page.getByRole('img', { name: 'PNG export preview' })).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', { name: 'Accept the reported PNG losses', exact: true }),
    ).not.toBeChecked();
    await acceptLosses('PNG');
    await page.locator('[data-zloz-png-action="render"]').click();
    const preview = page.getByRole('img', { name: 'PNG export preview' });
    await expect(preview).toBeVisible();
    const png = await download(
      page.locator('[data-zloz-png-action="download"]'),
      `workshop-export-${scheme}.png`,
    );
    expect(
      png.equals(Buffer.from((await preview.getAttribute('src')).split(',')[1], 'base64')),
    ).toBe(true);
    const matching = await page.evaluate(
      async ({ vector, raster }) => {
        const svgImage = new Image(),
          pngImage = new Image();
        svgImage.src = 'data:image/svg+xml;base64,' + vector;
        pngImage.src = 'data:image/png;base64,' + raster;
        await Promise.all([svgImage.decode(), pngImage.decode()]);
        if (svgImage.width !== pngImage.width || svgImage.height !== pngImage.height) return false;
        const canvas = document.createElement('canvas');
        canvas.width = pngImage.width;
        canvas.height = pngImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(svgImage, 0, 0);
        const expected = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(pngImage, 0, 0);
        const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return expected.every((v, i) => v === actual[i]);
      },
      { vector: svg.toString('base64'), raster: png.toString('base64') },
    );
    expect(matching).toBe(true);
    await page.screenshot({ path: file(`workshop-export-workbench-${scheme}.png`) });
  }
  expect(await model()).toBe(before);
  // Authored status changes invalidate both review consent and PNG pixels; Undo restores meaning.
  await section('Inspect');
  await page
    .getByRole('combobox', { name: 'Inspect workshop node', exact: true })
    .selectOption('retry-question');
  await button('Set hotspot status to Resolved').press('Enter');
  await section('PNG export');
  await expect(page.getByRole('img', { name: 'PNG export preview' })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: 'Accept the reported PNG losses', exact: true }),
  ).not.toBeChecked();
  await section('SVG export');
  await expect(button('Download SVG')).toBeDisabled();
  await acceptLosses('SVG');
  const changed = await download(button('Download SVG'), 'workshop-export-resolved.svg');
  expect(changed.toString()).not.toContain('Open question');
  await section('Diagram');
  await button('Undo').click();
  expect(await model()).toBe(before);
  // Exercise actual public browser API, capture the Blob fed to Image and compare every RGBA pixel
  // against independent decoding of the reviewed SVG; check literal theme accents in note regions.
  const result = await page.evaluate(async () => {
    const { createEditor, createEventStormingWorkshopPattern, writeSvgExport } =
      await import('/__png/index.mjs');
    const { renderPngExport } = await import('/__png/browser.mjs');
    const editor = createEditor(createEventStormingWorkshopPattern());
    const original = JSON.stringify(editor);
    const outputs = [];
    const opts = (scheme) => ({
      title: 'Workshop export qualification',
      region: { type: 'model', padding: 40 },
      theme: { colorScheme: scheme },
      background: { type: 'theme' },
      font: { family: 'sans-serif', size: 14, weight: 400 },
      renderers: { nodes: 'built-in', edges: 'built-in' },
    });
    const decode = async (url, width, height) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height).data;
    };
    for (const scheme of ['light', 'dark']) {
      const svg = opts(scheme),
        writing = { allowLosses: true };
      const written = writeSvgExport(editor, svg, writing);
      if (written.type !== 'written') throw new Error('SVG blocked');
      let seen;
      const create = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        seen = blob;
        return create.call(URL, blob);
      };
      const rendered = await renderPngExport({
        snapshot: editor,
        svg,
        writing,
        expectedSvg: written.svg,
      }).finally(() => {
        URL.createObjectURL = create;
      });
      if (rendered.type !== 'rendered') throw new Error(JSON.stringify(rendered));
      if ((await seen.text()) !== written.svg) throw new Error('PNG used different SVG');
      const { width, height, dataUrl } = rendered.artifact;
      const expected = await decode(
        'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(written.svg),
        width,
        height,
      );
      const actual = await decode(dataUrl, width, height);
      if (expected.length !== actual.length || expected.some((value, i) => value !== actual[i]))
        throw new Error('SVG and PNG pixels differ');
      const count = (hex, x, y, w, h) => {
        const rgb = hex.match(/\w\w/gu).map((n) => parseInt(n, 16));
        let n = 0;
        const bounds = written.plan.viewBox;
        for (let py = Math.ceil(y - bounds.y); py < y + h - bounds.y; py++)
          for (let px = Math.ceil(x - bounds.x); px < x + w - bounds.x; px++) {
            const i = (py * width + px) * 4;
            if (rgb.every((v, k) => Math.abs(v - actual[i + k]) < 3) && actual[i + 3] === 255) n++;
          }
        return n;
      };
      const accents =
        scheme === 'light' ? ['be123c', '047857', '0e7490'] : ['fda4af', '6ee7b7', '67e8f9'];
      const pixels = [
        count(accents[0], 140, 390, 330, 170),
        count(accents[1], 590, 390, 330, 170),
        count(accents[2], 400, 150, 210, 150),
      ];
      if (pixels.some((n) => n < 40))
        throw new Error('Missing status/external-system accent pixels: ' + pixels);
      const changed = {
        graph: {
          ...editor.graph,
          nodes: editor.graph.nodes.map((n) =>
            n.architecture?.role === 'hotspot'
              ? { ...n, architecture: { ...n.architecture, status: 'resolved' } }
              : n,
          ),
        },
      };
      for (const input of [
        { snapshot: changed, svg },
        { snapshot: editor, svg: opts(scheme === 'light' ? 'dark' : 'light') },
      ]) {
        const stale = await renderPngExport({ ...input, writing, expectedSvg: written.svg });
        if (stale.type !== 'failed' || stale.code !== 'source-changed')
          throw new Error('Stale source was not rejected');
      }
      outputs.push({ scheme, width, height, pixels, pixelEquality: true, blobEquality: true });
    }
    if (JSON.stringify(editor) !== original) throw new Error('Export mutated editor');
    return outputs;
  });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        result: 'passed',
        workbench: 'loss consent, exact downloads, themes, status freshness and Undo',
        publicBrowser: result,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
}
await run().finally(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});
