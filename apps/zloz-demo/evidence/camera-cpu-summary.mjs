import { readFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
const workspace = new URL('../../../', import.meta.url);
const packages = new URL('packages/', workspace);
const profiles = process.argv.slice(2);
if (profiles.length === 0) throw new Error('Pass one or more Chromium .cpuprofile files');

const maps = new Map();

function loadMap(file) {
  const existing = maps.get(file.href);
  if (existing) return existing;
  const pending = readFile(file, 'utf8')
    .catch(() => null)
    .then((raw) => (raw === null ? null : new SourceMap(JSON.parse(raw))));
  maps.set(file.href, pending);
  return pending;
}

async function frameLabel(frame) {
  const name = frame.functionName || '(anonymous)';
  if (!frame.url) return name;
  const path = new URL(frame.url).pathname;
  const file = new URL(`.${path}.map`, dist);
  const map = await loadMap(file);
  const entry = map?.findEntry(frame.lineNumber, frame.columnNumber);
  if (!entry?.originalSource) return `${name} · ${path}:${frame.lineNumber + 1} (unmapped)`;

  const original = new URL(entry.originalSource, file);
  if (original.pathname.startsWith(packages.pathname) && original.pathname.includes('/dist/')) {
    const sourceMapFile = new URL(`${original.href}.map`);
    const sourceMap = await loadMap(sourceMapFile);
    const source = sourceMap?.findEntry(entry.originalLine, entry.originalColumn);
    if (source?.originalSource) {
      const sourceFile = new URL(source.originalSource, sourceMapFile);
      return `${source.name ?? entry.name ?? name} · ${relative(fileURLToPath(workspace), fileURLToPath(sourceFile))}:${source.originalLine + 1}`;
    }
  }
  return `${entry.name ?? name} · ${relative(fileURLToPath(workspace), fileURLToPath(original))}:${entry.originalLine + 1}`;
}

function increment(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function ranked(counts, denominator) {
  return [...counts]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 40)
    .map(([frame, samples]) => ({
      frame,
      samples,
      percent: Math.round((samples / denominator) * 1000) / 10,
    }));
}

async function summarize(path) {
  const profile = JSON.parse(await readFile(path, 'utf8'));
  const entries = await Promise.all(
    profile.nodes.map(async ({ id, callFrame }) => [id, await frameLabel(callFrame)]),
  );
  const frames = new Map(entries);
  const parents = new Map(
    profile.nodes.flatMap(({ id, children }) => (children ?? []).map((child) => [child, id])),
  );
  const sampled = new Set(['(idle)', '(program)', '(garbage collector)']);
  const special = new Map();
  const self = new Map();
  const inclusive = new Map();
  let active = 0;

  for (const id of profile.samples) {
    const leaf = frames.get(id);
    if (sampled.has(leaf)) {
      increment(special, leaf);
      continue;
    }
    active += 1;
    increment(self, leaf);
    const stack = new Set();
    let ancestor = id;
    while (ancestor !== undefined) {
      stack.add(frames.get(ancestor));
      ancestor = parents.get(ancestor);
    }
    for (const frame of stack) increment(inclusive, frame);
  }
  return {
    path,
    durationMs: Math.round((profile.endTime - profile.startTime) / 1000),
    samples: profile.samples.length,
    active,
    unmappedActiveSamples: [...self].reduce(
      (count, [frame, hits]) => (frame.endsWith(' (unmapped)') ? count + hits : count),
      0,
    ),
    special: Object.fromEntries(special),
    self: ranked(self, active),
    inclusive: ranked(inclusive, active),
  };
}

const results = [];
for (const profile of profiles) results.push(await summarize(profile));
console.log(JSON.stringify(results, null, 2));
