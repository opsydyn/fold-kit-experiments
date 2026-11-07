import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { SourceMap } from 'node:module';
import { cpus, arch, release } from 'node:os';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const profilePath = process.env.FLOW_CHOOSER_CPU_PROFILE;
const retained = process.env.FLOW_CHOOSER_BENCH_RETAINED === '1';
const retainedCreation = process.env.FLOW_CHOOSER_BENCH_RETAINED_CREATION === '1';
const viewport = { width: 1280, height: 1100 };
const runs = profilePath ? 1 : 3;
const warmup = 4;
const samplesPerRun = 20;
const reverse = process.env.FLOW_CHOOSER_BENCH_REVERSE === '1';
const fixtures = [
  { name: 'release-creation-broad', large: false, kind: 'creation', base: '' },
  { name: 'large-creation-broad', large: true, kind: 'creation', base: '' },
  { name: 'large-creation-selective', large: true, kind: 'creation', base: 'load-20-' },
  { name: 'release-reconnection-broad', large: false, kind: 'reconnection', base: '' },
  { name: 'large-reconnection-broad', large: true, kind: 'reconnection', base: '' },
  { name: 'large-reconnection-selective', large: true, kind: 'reconnection', base: 'load-20-' },
];
if (profilePath)
  fixtures.splice(
    0,
    fixtures.length,
    ...fixtures.filter((fixture) => fixture.name === 'large-reconnection-broad'),
  );
if (retained)
  fixtures.splice(
    0,
    fixtures.length,
    ...fixtures.filter(
      (fixture) =>
        fixture.large && fixture.kind === (retainedCreation ? 'creation' : 'reconnection'),
    ),
  );
if (reverse) fixtures.reverse();

function distribution(samples, key) {
  const sorted = samples.map((sample) => sample[key]).sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}

async function installProbe(page, input, select, base, expectedBase, expectedEmpty) {
  await page.evaluate(
    ({ inputId, selectId, base, expectedBase, expectedEmpty }) => {
      const input = document.getElementById(inputId);
      const select = document.getElementById(selectId);
      const probe = { samples: [], pending: null, waiter: null, keydown: 0 };
      input.addEventListener(
        'keydown',
        (event) => {
          if (event.isTrusted) probe.keydown = event.timeStamp;
        },
        true,
      );
      input.addEventListener(
        'input',
        (event) => {
          if (!event.isTrusted) throw new Error('Benchmark requires trusted input');
          if (probe.pending) throw new Error('Benchmark inputs overlapped');
          const query = input.value;
          if (query !== base && query !== base + 'z') throw new Error('Unexpected benchmark query');
          probe.pending = {
            query,
            inputTime: event.timeStamp,
            listenerTime: performance.now(),
            keyTime: probe.keydown,
          };
        },
        true,
      );
      new MutationObserver(() => {
        if (!probe.pending) return;
        const expected = probe.pending.query === base ? expectedBase : expectedEmpty;
        const values = [...select.options].map((option) => option.value);
        if (JSON.stringify(values) !== JSON.stringify(expected)) return;
        const pending = probe.pending;
        probe.pending = null;
        const domTime = performance.now();
        requestAnimationFrame(() => {
          const sample = {
            query: pending.query,
            direction: pending.query === base ? 'expand' : 'narrow',
            optionCount: values.length,
            inputToDomMs: domTime - pending.inputTime,
            listenerToDomMs: domTime - pending.listenerTime,
            inputToFrameMs: performance.now() - pending.inputTime,
            keydownToFrameMs: performance.now() - pending.keyTime,
          };
          probe.samples.push(sample);
          if (probe.waiter) {
            probe.waiter(sample);
            probe.waiter = null;
          }
        });
      }).observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
      window.__flowChooserProbe = probe;
    },
    {
      inputId: await input.getAttribute('id'),
      selectId: await select.getAttribute('id'),
      base,
      expectedBase,
      expectedEmpty,
    },
  );
}

async function inputSample(page, index) {
  await page.keyboard.press(index % 2 === 0 ? 'z' : 'Backspace');
  return page.evaluate((index) => {
    const probe = window.__flowChooserProbe;
    if (probe.samples[index]) return probe.samples[index];
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('No expected option update for trusted input')),
        10000,
      );
      probe.waiter = (sample) => {
        clearTimeout(timeout);
        resolve(sample);
      };
    });
  }, index);
}

async function profileSources(profile) {
  const files = new Map();
  const loadMap = async (filename) => {
    if (!files.has(filename)) {
      const payload = await readFile(filename, 'utf8')
        .then(JSON.parse)
        .catch(() => null);
      files.set(filename, payload ? { map: new SourceMap(payload), filename } : null);
    }
    return files.get(filename);
  };
  const sourceByNode = new Map();
  for (const node of profile.nodes) {
    const frame = node.callFrame;
    if (!frame.url.startsWith('http:')) continue;
    let map = await loadMap(resolve('../flow-sample/dist' + new URL(frame.url).pathname + '.map'));
    let line = frame.lineNumber;
    let column = frame.columnNumber;
    let source;
    for (let depth = 0; map && depth < 8; depth++) {
      const entry = map.map.findEntry(line, column);
      if (!entry.originalSource) break;
      source = entry.originalSource.startsWith('file:')
        ? fileURLToPath(entry.originalSource)
        : resolve(dirname(map.filename), entry.originalSource);
      line = entry.originalLine;
      column = entry.originalColumn;
      map = await loadMap(source + '.map');
    }
    if (source)
      sourceByNode.set(
        node.id,
        relative(resolve('../..'), source).replace(/^.*?node_modules\//, 'node_modules/'),
      );
  }
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parents.set(child, node.id);
  const sources = new Map();
  const unmapped = new Map();
  let idleMs = 0;
  let gcMs = 0;
  let unmappedMs = 0;
  for (let index = 0; index < (profile.samples?.length ?? 0); index++) {
    const ms = (profile.timeDeltas[index] ?? 0) / 1000;
    let node = nodes.get(profile.samples[index]);
    const leaf = node;
    if (node?.callFrame.functionName === '(idle)') {
      idleMs += ms;
      continue;
    }
    if (node?.callFrame.functionName === '(garbage collector)') {
      gcMs += ms;
      continue;
    }
    let source;
    while (node) {
      source = sourceByNode.get(node.id);
      if (source) break;
      node = nodes.get(parents.get(node.id));
    }
    if (!source) {
      unmappedMs += ms;
      const name = leaf?.callFrame.functionName || leaf?.callFrame.url || '(anonymous/eval)';
      unmapped.set(name, (unmapped.get(name) ?? 0) + ms);
      continue;
    }
    sources.set(source, (sources.get(source) ?? 0) + ms);
  }
  return {
    samples: profile.samples?.length ?? 0,
    idleMs,
    gcMs,
    unmappedMs,
    attribution:
      'nearest source-mapped JavaScript ancestor, chaining Vite and package maps; sampled time, not exact function duration',
    sources: [...sources]
      .map(([source, sampledMs]) => ({ source, sampledMs }))
      .sort((a, b) => b.sampledMs - a.sampledMs),
    unmapped: [...unmapped]
      .map(([name, sampledMs]) => ({ name, sampledMs }))
      .sort((a, b) => b.sampledMs - a.sampledMs),
  };
}

async function qualify(browser, fixture) {
  const samples = [];
  let metadata;
  let cpu;
  for (let run = 0; run < runs; run++) {
    const page = await browser.newPage({ viewport, colorScheme: 'light', reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    const execute = async () => {
      await page.goto('http://127.0.0.1:' + server.address().port);
      if (fixture.large)
        await page
          .getByRole('button', { name: 'Open large workflow (320 nodes)', exact: true })
          .click();
      const surface = page.locator('[data-flow-surface]');
      await expect(surface.locator('[data-flow-node]')).toHaveCount(fixture.large ? 320 : 3);
      await expect(surface.locator('[data-flow-edge]')).toHaveCount(fixture.large ? 452 : 1);
      if (retained) {
        const toggle = page.getByRole('button', { name: 'Retain node views', exact: true });
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      }
      const creation = fixture.kind === 'creation';
      if (!creation)
        await page
          .getByRole('button', {
            name: fixture.large ? 'load-1-1:out → load-1-2:in' : 'source:out → review:in',
            exact: true,
          })
          .click();
      const group = page.getByRole('group', {
        name: creation ? 'Create a connection' : 'Selected connection',
        exact: true,
      });
      const select = group.getByRole('combobox', {
        name: creation ? 'New connection target' : 'Target port',
        exact: true,
      });
      const input = page.getByRole('searchbox', {
        name: creation ? 'Search new connection targets' : 'Search reconnection targets',
        exact: true,
      });
      if (creation) {
        await group
          .getByRole('combobox', { name: 'New connection source', exact: true })
          .selectOption(JSON.stringify([fixture.large ? 'load-1-1' : 'review', 'out']));
        await expect(select.locator('option').last()).toBeEnabled();
      }
      const full = await select.evaluate((element) =>
        [...element.options].map((option) => option.value),
      );
      const current = await select.inputValue();
      const expectedBase = full.filter(
        (value) =>
          value === '' ||
          value === current ||
          fixture.base === '' ||
          JSON.parse(value)[0].includes(fixture.base),
      );
      const expectedEmpty = creation ? [''] : [current];
      await input.fill(fixture.base);
      await expect(select.locator('option')).toHaveCount(expectedBase.length);
      await page.evaluate(() => document.fonts.ready);
      await input.focus();
      metadata = {
        nodes: fixture.large ? 320 : 3,
        edges: fixture.large ? 452 : 1,
        candidates: full.length - (creation ? 1 : 0),
        expandedOptions: expectedBase.length,
        narrowedOptions: expectedEmpty.length,
        retainedLayerMounted: await surface.evaluate((element) =>
          [...element.querySelectorAll('div')].some(
            (node) => node.style.display === 'contents' && node.querySelector('[data-flow-node]'),
          ),
        ),
        pageElements: await page.locator('*').count(),
        userAgent: await page.evaluate(() => navigator.userAgent),
      };
      await installProbe(page, input, select, fixture.base, expectedBase, expectedEmpty);
      for (let index = 0; index < warmup + samplesPerRun; index++) {
        const sample = await inputSample(page, index);
        if (index >= warmup) samples.push({ run, ...sample });
      }
      await expect(input).toBeFocused();
      await expect(surface.locator('[data-flow-edge]')).toHaveCount(fixture.large ? 452 : 1);
      if (profilePath && fixture.name === 'large-reconnection-broad' && run === 0) {
        const session = await page.context().newCDPSession(page);
        await session.send('Profiler.enable');
        await session.send('Profiler.setSamplingInterval', { interval: 1000 });
        await session.send('Profiler.start');
        for (let index = warmup + samplesPerRun; index < warmup + samplesPerRun + 40; index++)
          await inputSample(page, index);
        const { profile } = await session.send('Profiler.stop');
        await writeFile(profilePath, JSON.stringify(profile));
        cpu = await profileSources(profile);
        await session.detach();
      }
      expect(errors).toEqual([]);
    };
    await execute().finally(() => page.close());
  }
  return {
    name: fixture.name,
    ...metadata,
    summaries: Object.fromEntries(
      ['inputToDomMs', 'listenerToDomMs', 'inputToFrameMs', 'keydownToFrameMs'].map((key) => [
        key,
        distribution(samples, key),
      ]),
    ),
    samples,
    cpu,
  };
}

async function main() {
  const browser = await chromium.launch();
  const execute = async () => {
    const results = [];
    for (const fixture of fixtures) {
      console.error('Measuring ' + fixture.name);
      results.push(await qualify(browser, fixture));
    }
    console.log(
      JSON.stringify(
        {
          productionHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
          browser: browser.version(),
          machine: { cpu: cpus()[0]?.model, arch: arch(), os: release() },
          viewport,
          runs,
          warmup,
          samplesPerRun,
          order: reverse ? 'reverse' : 'forward',
          cpuThrottling: 'none',
          retainedNodeViews: retained,
          profileOnly: Boolean(profilePath),
          method:
            'serial direct trusted keyboard z/Backspace inputs alternating broad/selective result sets with no results; DOM acknowledgement then next rAF; not INP or paint latency',
          results,
        },
        null,
        2,
      ),
    );
  };
  await execute().finally(() => browser.close());
}
async function analyzeExisting(path) {
  const profile = JSON.parse(await readFile(path, 'utf8'));
  console.log(
    JSON.stringify(
      {
        productionHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        profile: basename(path),
        cpu: await profileSources(profile),
      },
      null,
      2,
    ),
  );
}
const analysis = process.env.FLOW_CHOOSER_ANALYZE_PROFILE;
await (analysis ? analyzeExisting(analysis) : main()).finally(
  () => new Promise((resolve) => server.close(resolve)),
);
