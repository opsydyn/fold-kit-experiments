import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { arch, cpus, release } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

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

const viewport = { width: 1280, height: 1100 };
const runs = 3;
const samplesPerRun = 20;
const warmup = 4;
const worldSelector = ':scope > div[style*="transform-origin"]';
const cpuProfilePath = process.env.FLOW_BENCHMARK_CPU_PROFILE;
const compareRetained = process.env.FLOW_BENCHMARK_COMPARE_RETAINED === '1';
const sustained =
  compareRetained || Boolean(cpuProfilePath) || process.env.FLOW_BENCHMARK_BURST === '1';
const scenarioRuns = cpuProfilePath ? 1 : runs;
const comparison = sustained || process.env.FLOW_BENCHMARK_COMPARE_CULLING === '1';
const burstInputs = 180;
const burstHz = 120;
const cases = compareRetained
  ? [
      {
        name: 'Large · default',
        nodes: 320,
        edges: 452,
        minimal: false,
        culling: false,
        retain: false,
      },
      {
        name: 'Large · retained',
        nodes: 320,
        edges: 452,
        minimal: false,
        culling: false,
        retain: true,
      },
    ]
  : comparison
    ? [
        { name: 'Large · default', nodes: 320, edges: 452, minimal: false, culling: false },
        { name: 'Large · culled', nodes: 320, edges: 452, minimal: false, culling: true },
      ]
    : [
        { name: 'Release · default', nodes: 3, edges: 1, minimal: false },
        { name: 'Large · default', nodes: 320, edges: 452, minimal: false },
        { name: 'Large · minimal', nodes: 320, edges: 452, minimal: true },
      ];

async function backgroundPoint(surface) {
  return surface.evaluate((element, centerGraph) => {
    const box = element.getBoundingClientRect();
    const startX = centerGraph ? box.width / 2 - 100 : 64;
    const startY = centerGraph ? box.height / 2 - 65 : 48;
    for (let y = startY; y < box.height - 48; y += 14) {
      for (let x = startX; x < box.width / 2 + (centerGraph ? 100 : 0); x += 14) {
        const left = Math.round(box.left + x);
        const top = Math.round(box.top + y);
        if (document.elementFromPoint(left, top) === element) return { x: left, y: top };
      }
    }
    throw new Error('No canvas background point available for camera input');
  }, comparison);
}

async function prepareCamera(page, surface, world) {
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  await surface.scrollIntoViewIfNeeded();
  const zoom = () =>
    world.evaluate((element) => Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1]));
  let current = await zoom();
  for (let attempt = 0; attempt < 5 && Math.abs(current - 1) > 0.01; attempt++) {
    const point = await backgroundPoint(surface);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, Math.round(Math.max(-500, Math.min(500, Math.log(current) / 0.002))));
    await expect.poll(zoom).not.toBe(current);
    current = await zoom();
  }
  expect(current).toBeCloseTo(1, 2);
  return backgroundPoint(surface);
}

async function measure(page, surface, point, kind) {
  const pan = kind === 'pan';
  await page.mouse.move(point.x, point.y);
  if (pan) await page.mouse.down();
  await surface.evaluate(
    (element, { selector, eventName }) => {
      const world = element.querySelector(selector);
      let transform = world.style.transform;
      let pending;
      const samples = [];
      const onInput = (event) => {
        if (event.isTrusted)
          pending = { inputTime: event.timeStamp, listenerTime: performance.now() };
      };
      const observer = new MutationObserver(() => {
        const next = world.style.transform;
        if (next === transform) return;
        transform = next;
        if (pending === undefined) return;
        const { inputTime, listenerTime } = pending;
        pending = undefined;
        const updateTime = performance.now();
        requestAnimationFrame(() =>
          samples.push({
            listenerToUpdateMs: updateTime - listenerTime,
            updateMs: updateTime - inputTime,
            frameMs: performance.now() - inputTime,
          }),
        );
      });
      element.addEventListener(eventName, onInput, { capture: true, passive: true });
      observer.observe(world, { attributes: true, attributeFilter: ['style'] });
      window.flowCameraProbe = {
        samples,
        stop() {
          observer.disconnect();
          element.removeEventListener(eventName, onInput, true);
          delete window.flowCameraProbe;
          return samples;
        },
      };
    },
    { selector: worldSelector, eventName: pan ? 'pointermove' : 'wheel' },
  );

  for (let index = 0; index < warmup + samplesPerRun; index++) {
    // Reversible input in ten-step legs. The four warmups start with a shorter out-and-back.
    const leg = index < warmup ? index : (index - warmup) % 20;
    const steps = index < warmup ? 2 : 10;
    if (pan) {
      const offset = leg < steps ? leg + 1 : 2 * steps - leg - 1;
      await page.mouse.move(point.x + offset * 14, point.y + offset * 3);
    } else {
      await page.mouse.wheel(0, leg < steps ? -28 : 28);
    }
    const ready = await page.waitForFunction(
      (count) => window.flowCameraProbe.samples.length === count,
      index + 1,
      { timeout: 5000 },
    );
    await ready.dispose();
  }
  if (pan) await page.mouse.up();
  const observed = await page.evaluate(() => window.flowCameraProbe.stop());
  expect(observed).toHaveLength(warmup + samplesPerRun);
  return observed.slice(warmup);
}

async function measureBurst(page, surface, world, point, kind, profilePath) {
  const pan = kind === 'pan';
  const session = await page.context().newCDPSession(page);
  const run = async () => {
    const readCamera = () =>
      world.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(element.style.transform);
        return { x: matrix.e, y: matrix.f, zoom: matrix.a };
      });
    const start = await readCamera();
    await page.mouse.move(point.x, point.y);
    if (pan)
      await session.send('Input.dispatchMouseEvent', {
        ...point,
        type: 'mousePressed',
        button: 'left',
        buttons: 1,
        force: 0.5,
        clickCount: 1,
      });
    await surface.evaluate(
      (element, { selector, eventName }) => {
        const world = element.querySelector(selector);
        let delivered = 0;
        let commits = 0;
        let previousTime;
        let previousCommits = 0;
        let frame;
        const intervals = [];
        const onInput = (event) => {
          if (event.isTrusted) delivered += 1;
        };
        const readTransform = (style) => style?.match(/(?:^|;)\s*transform:\s*([^;]+)/)?.[1];
        const observer = new MutationObserver((records) => {
          // Old values preserve intermediate commits when one observer callback receives several.
          const transforms = records.map(({ oldValue }) => readTransform(oldValue));
          transforms.push(world.style.transform);
          for (let index = 0; index < records.length; index++)
            if (transforms[index] !== transforms[index + 1]) commits += 1;
        });
        function tick(time) {
          if (previousTime !== undefined)
            intervals.push({ gapMs: time - previousTime, commits: commits - previousCommits });
          previousTime = time;
          previousCommits = commits;
          frame = requestAnimationFrame(tick);
        }
        element.addEventListener(eventName, onInput, { capture: true, passive: true });
        observer.observe(world, {
          attributes: true,
          attributeFilter: ['style'],
          attributeOldValue: true,
        });
        window.flowBurstProbe = {
          stop() {
            observer.disconnect();
            cancelAnimationFrame(frame);
            element.removeEventListener(eventName, onInput, true);
            delete window.flowBurstProbe;
            return { delivered, commits, intervals };
          },
        };
        return new Promise((resolve) => {
          frame = requestAnimationFrame((time) => {
            tick(time);
            resolve();
          });
        });
      },
      { selector: worldSelector, eventName: pan ? 'pointermove' : 'wheel' },
    );

    if (profilePath) {
      await session.send('Profiler.enable');
      await session.send('Profiler.setSamplingInterval', { interval: 1000 });
      await session.send('Profiler.start');
    }
    const sent = [];
    const dispatchErrors = [];
    const startedAt = performance.now();
    for (let index = 0; index < burstInputs; index++) {
      const delay = startedAt + (index * 1000) / burstHz - performance.now();
      if (delay > 0) await sleep(delay);
      const input = pan
        ? {
            type: 'mouseMoved',
            x: point.x + index + 1,
            y: point.y,
            button: 'left',
            buttons: 1,
            force: 0.5,
          }
        : { type: 'mouseWheel', ...point, deltaX: 0, deltaY: -1 };
      sent.push(
        session.send('Input.dispatchMouseEvent', input).catch((error) => {
          dispatchErrors.push(String(error));
        }),
      );
    }
    const dispatchMs = Math.round(performance.now() - startedAt);
    await Promise.all(sent);
    expect(dispatchErrors).toEqual([]);

    // Check the final gesture result so coalescing cannot quietly drop the total motion.
    const expected = pan ? start.x + burstInputs : start.zoom * Math.exp(burstInputs * 0.002);
    await expect
      .poll(async () => {
        const camera = await readCamera();
        return Math.abs((pan ? camera.x : camera.zoom) - expected);
      })
      .toBeLessThan(pan ? 1.1 : 0.005);
    const result = await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => resolve(window.flowBurstProbe.stop())),
        ),
    );
    if (profilePath) {
      const { profile } = await session.send('Profiler.stop');
      expect(profile.samples?.length).toBeGreaterThan(0);
      await writeFile(profilePath, JSON.stringify(profile));
    }
    if (pan)
      await session.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: point.x + burstInputs,
        y: point.y,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      });
    expect(result.delivered).toBeGreaterThan(0);
    expect(result.commits).toBeGreaterThan(0);
    expect(result.intervals.length).toBeGreaterThan(0);
    return { dispatchMs, ...result };
  };
  return run().finally(() => session.detach());
}

function summarizeBursts(bursts) {
  const intervals = bursts.flatMap(({ intervals }) => intervals);
  return {
    runs: bursts.map(({ delivered, commits, dispatchMs, intervals }) => ({
      delivered,
      commits,
      dispatchMs,
      observedMs: Math.round(intervals.reduce((total, { gapMs }) => total + gapMs, 0)),
    })),
    frameGapMs: summarize(intervals, 'gapMs'),
    maxFrameGapMs: Math.round(Math.max(...intervals.map(({ gapMs }) => gapMs)) * 10) / 10,
    frames: intervals.length,
    framesOver25Ms: intervals.filter(({ gapMs }) => gapMs > 25).length,
    multiCommitFrames: intervals.filter(({ commits }) => commits > 1).length,
    extraCommits: intervals.reduce((total, { commits }) => total + Math.max(0, commits - 1), 0),
  };
}

function summarize(samples, field) {
  const sorted = samples.map((sample) => sample[field]).sort((left, right) => left - right);
  const percentile = (fraction) =>
    Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10;
  return { p50: percentile(0.5), p95: percentile(0.95) };
}

async function qualify(browser, fixture) {
  const page = await browser.newPage({ viewport, colorScheme: 'light', reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const run = async () => {
    await page.goto('http://127.0.0.1:' + server.address().port);
    if (fixture.nodes > 3)
      await page.getByRole('button', { name: 'Open large workflow (320 nodes)' }).click();
    const surface = page.locator('[data-flow-surface]');
    const world = surface.locator(worldSelector);
    await expect(surface.locator('[data-flow-node]')).toHaveCount(fixture.nodes);
    await expect(surface.locator('[data-flow-edge]')).toHaveCount(fixture.edges);
    if (fixture.name === 'Large · default') {
      const screenshot = process.env.FLOW_BENCHMARK_SCREENSHOT;
      if (screenshot) await surface.screenshot({ path: screenshot, timeout: 15000 });
    }
    if (fixture.minimal)
      await page.getByRole('button', { name: 'Minimal mode', exact: true }).click();
    if (fixture.retain) {
      const toggle = page.getByRole('button', { name: 'Retain node views', exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }
    if (fixture.culling) {
      const toggle = page.getByRole('button', { name: 'Viewport culling', exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }

    const results = {};
    if (cpuProfilePath) {
      const point = await prepareCamera(page, surface, world);
      await measureBurst(page, surface, world, point, 'zoom');
    }
    const operations = cpuProfilePath || compareRetained ? ['zoom'] : ['pan', 'zoom'];
    for (const kind of operations) {
      if (sustained) {
        const bursts = [];
        for (let run = 0; run < scenarioRuns; run++) {
          const point = await prepareCamera(page, surface, world);
          bursts.push(await measureBurst(page, surface, world, point, kind, cpuProfilePath));
        }
        results[kind] = summarizeBursts(bursts);
        continue;
      }
      const samples = [];
      for (let run = 0; run < runs; run++) {
        const point = await prepareCamera(page, surface, world);
        samples.push(...(await measure(page, surface, point, kind)));
      }
      results[kind] = {
        samples: samples.length,
        domUpdateMs: summarize(samples, 'updateMs'),
        nextFrameMs: summarize(samples, 'frameMs'),
        listenerToUpdateMs: summarize(samples, 'listenerToUpdateMs'),
      };
    }
    const elements = await page.locator('*').count();
    const canvasElements = await surface.locator('*').count();
    const mountedNodes = await surface.locator('[data-flow-node]').count();
    const mountedEdges = await surface.locator('[data-flow-edge]').count();
    if (fixture.culling) {
      expect(mountedNodes).toBeGreaterThan(0);
      expect(mountedNodes).toBeLessThan(fixture.nodes);
      expect(mountedEdges).toBeGreaterThan(0);
      expect(mountedEdges).toBeLessThan(fixture.edges);
      await expect(
        surface.locator('[data-flow-minimap] rect:not([data-flow-minimap-viewport])'),
      ).toHaveCount(fixture.nodes);
      await expect(page.locator('[data-flow-connections] button[aria-pressed]')).toHaveCount(
        fixture.edges,
      );
      const screenshot = process.env.FLOW_BENCHMARK_CULLING_SCREENSHOT;
      if (screenshot) await surface.screenshot({ path: screenshot, timeout: 15000 });
      await page.getByRole('button', { name: 'Fit view', exact: true }).click();
      await expect(surface.locator('[data-flow-node]')).toHaveCount(fixture.nodes);
    }
    expect(errors).toEqual([]);
    return { ...fixture, elements, canvasElements, mountedNodes, mountedEdges, ...results };
  };
  return run().finally(() => page.close());
}

async function benchmark() {
  const browser = await chromium.launch();
  const run = async () => {
    const results = [];
    const selectedCases = cpuProfilePath ? cases.filter((fixture) => !fixture.culling) : cases;
    const order =
      process.env.FLOW_BENCHMARK_REVERSE === '1' ? [...selectedCases].reverse() : selectedCases;
    for (const fixture of order) results.push(await qualify(browser, fixture));
    console.log(
      JSON.stringify(
        {
          chromium: browser.version(),
          host: { arch: arch(), release: release(), cpu: cpus()[0]?.model },
          viewport,
          runs: scenarioRuns,
          cpuProfileWarmupBursts: cpuProfilePath ? 1 : 0,
          samplesPerRun: sustained ? burstInputs : samplesPerRun,
          warmup: sustained ? 0 : warmup,
          burst: sustained ? { inputs: burstInputs, hz: burstHz } : null,
          results,
        },
        null,
        2,
      ),
    );
  };
  await run().finally(() => browser.close());
}
await benchmark().finally(() => new Promise((resolve) => server.close(resolve)));
