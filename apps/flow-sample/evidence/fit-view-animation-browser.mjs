import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import { chromium, expect } from '@playwright/test';
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  await readFile('../flow-sample/dist' + path)
    .then((body) => {
      res.setHeader(
        'Content-Type',
        path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
      );
      res.end(body);
    })
    .catch(() => res.writeHead(404).end());
});
await new Promise((resolve, reject) =>
  server.once('error', reject).listen(0, '127.0.0.1', resolve),
);
function readCamera(element) {
  const world = [...element.children].find((child) =>
    child.style.transform.startsWith('translate'),
  );
  const matrix = new DOMMatrix(getComputedStyle(world).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
}

function recordFit(element, fitButton) {
  const world = [...element.children].find((child) =>
    child.style.transform.startsWith('translate'),
  );
  const frames = new Set([world.style.transform]);
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      frames.add(world.style.transform);
      if (frames.size > 1 && element.dataset.flowFitAnimation === '') {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(frames.size);
      }
    });
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('Fit view did not reach its target'));
    }, 2500);
    observer.observe(world, { attributeFilter: ['style'] });
    observer.observe(element, { attributeFilter: ['data-flow-fit-animation'] });
    fitButton.click();
  });
}

const qualify = async () => {
  const browser = await chromium.launch();
  const run = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const exportGraph = async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        button('Export JSON').click(),
      ]);
      return readFile(await download.path(), 'utf8');
    };
    const surface = page.locator('[data-flow-surface]');
    const animateFit = page.getByRole('checkbox', { name: 'Animate Fit view' });
    const camera = () => surface.evaluate(readCamera);
    const captureFit = async () => {
      const fit = await button('Fit view').elementHandle();
      return surface.evaluate(recordFit, fit).finally(() => fit.dispose());
    };
    const zoomAway = async () => {
      const fitted = await camera();
      await button('Zoom out').click();
      await expect.poll(camera).not.toEqual(fitted);
    };

    await page.goto('http://127.0.0.1:' + server.address().port);
    const initial = await exportGraph();
    await expect(animateFit).not.toBeChecked();
    const start = await camera();
    await button('Fit view').click();
    await expect.poll(camera).not.toEqual(start);
    const target = await camera();
    await zoomAway();
    await animateFit.check();
    await expect(animateFit).toBeChecked();

    const normalFrames = await captureFit();
    expect(normalFrames).toBeGreaterThan(2);
    expect(await camera()).toEqual(target);

    await zoomAway();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await captureFit()).toBe(2);
    expect(await camera()).toEqual(target);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await zoomAway();
    const before = await camera();
    await button('Fit view').click();
    await expect.poll(camera).not.toEqual(before);
    await expect(surface).toHaveAttribute('data-flow-fit-animation', /^[1-9]\d*$/);
    await button('Zoom in').click();
    await expect(surface).toHaveAttribute('data-flow-fit-animation', '');
    const interrupted = await camera();
    expect(interrupted).not.toEqual(target);
    await page.waitForTimeout(450);
    expect(await camera()).toEqual(interrupted);

    await button('Fit view').click();
    await expect.poll(camera).toEqual(target);
    await surface.scrollIntoViewIfNeeded();
    const canvas = await surface.boundingBox();
    const toggle = await animateFit.boundingBox();
    await page.screenshot({
      path: '/tmp/foldkit-flow-animated-fit.png',
      clip: {
        x: canvas.x - 12,
        y: toggle.y - 12,
        width: canvas.width + 24,
        height: canvas.y + canvas.height - toggle.y + 48,
      },
    });
    expect(await exportGraph()).toEqual(initial);
    expect(errors).toEqual([]);
    console.log(
      `Animated fit showed ${normalFrames - 2} intermediate views. Reduced motion and interruption passed.`,
    );
  };
  await run().finally(() => browser.close());
};
await qualify().finally(() => new Promise((resolve) => server.close(resolve)));
