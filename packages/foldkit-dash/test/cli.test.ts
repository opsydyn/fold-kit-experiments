/** The executable as an agent runs it: exit codes, the JSON envelope, and what it writes. */
import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Schema } from 'effect';

import { Envelope } from '../src/problems';
import { bars, fence, project, rows } from './support';

const bin = join(import.meta.dir, '..', 'src', 'bin.ts');

const run = (...args: ReadonlyArray<string>) => {
  const done = Bun.spawnSync(['bun', bin, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return { code: done.exitCode, out: done.stdout.toString(), err: done.stderr.toString() };
};

const envelopeOf = (out: string): Envelope =>
  Schema.decodeUnknownSync(Schema.fromJsonString(Envelope))(out.trim());

describe('foldkit-dash', () => {
  test('new, check, describe and build the starter: all exit 0', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'foldkit-dash-')), 'site');
    const started = run('new', dir, '--json');
    expect(started.code).toBe(0);
    expect(envelopeOf(started.out).written).toEqual([
      'AGENTS.md',
      'pages/index.md',
      'data/sales.json.ts',
      '.gitignore',
      'plot-spec.schema.json',
    ]);
    expect(JSON.parse(readFileSync(join(dir, 'plot-spec.schema.json'), 'utf8')).title).toBe(
      'foldkit-viz plot spec',
    );
    const checked = run('check', '-C', dir, '--json');
    expect(checked.code).toBe(0);
    expect(envelopeOf(checked.out)).toMatchObject({ command: 'check', status: 'ok', problems: [] });
    expect(envelopeOf(checked.out).charts).toHaveLength(2);
    const described = envelopeOf(run('describe', '-C', dir, '--json').out);
    expect(described.charts.map((chart) => chart.summary.split('.')[0])).toEqual([
      'Shows 4 lines',
      'Shows 4 boxes',
    ]);
    expect(described.charts[1]?.summary).toContain(
      'Region in 4 categories: North, South, East, West',
    );
    const built = run('build', '-C', dir);
    expect(built.code).toBe(0);
    expect(built.out).toBe('1 page, 2 charts, no problems. Wrote dist/.\n');
    expect(readFileSync(join(dir, 'dist/index.html'), 'utf8')).toContain('<h1>Weekly sales</h1>');
  });

  test('problems exit 1, with each problem on stdout as text or JSON', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence({ ...bars(rows), marks: [{ mark: 'bar', x: 'month', y: 'cost' }] })}`,
    });
    const text = run('check', '-C', root);
    expect(text.code).toBe(1);
    expect(text.out).toBe(
      'pages/index.md:3 spec: marks[0].y: field "cost" is missing from the data\n1 page, 1 chart, 1 problem.\n',
    );
    const json = run('check', '-C', root, '--json');
    expect(json.code).toBe(1);
    expect(envelopeOf(json.out).problems).toEqual([
      {
        kind: 'spec',
        file: 'pages/index.md',
        line: 3,
        path: 'marks[0].y',
        message: 'marks[0].y: field "cost" is missing from the data',
      },
    ]);
    // A build with problems still writes the page, showing them, and exits 1.
    expect(run('build', '-C', root).code).toBe(1);
    expect(readFileSync(join(root, 'dist/index.html'), 'utf8')).toContain('class="problem"');
  });

  test('a build replaces its own output folder, and only that', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars(rows))}`,
      'dist/old.html': 'from an earlier build',
    });
    expect(run('build', '-C', root).code).toBe(0);
    expect(existsSync(join(root, 'dist/old.html'))).toBe(false);
    for (const out of ['pages', 'data', 'node_modules/x', '.', '..', '/tmp/elsewhere']) {
      const refused = run('build', '-C', root, '--out', out);
      expect(refused.code).toBe(2);
      expect(refused.err).toContain('must be a folder inside the project');
    }
    expect(existsSync(join(root, 'pages/index.md'))).toBe(true);
  });

  test('what cannot run exits 2: no project, a folder in use, unknown commands', () => {
    expect(run('check', '-C', join(tmpdir(), 'no-such-dashboard')).code).toBe(2);
    const used = project({ 'notes.md': 'mine' });
    const refused = run('new', used);
    expect(refused.code).toBe(2);
    expect(refused.err).toContain('is not empty');
    expect(readFileSync(join(used, 'notes.md'), 'utf8')).toBe('mine');
    expect(run('frobnicate').code).toBe(2);
    expect(run('check', '--loader-timeout', 'soon').code).toBe(2);
    expect(run('--help').code).toBe(0);
  });

  test('check writes nothing but the loader cache', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('units.json'))}`,
      'data/units.json.ts': `console.log(${JSON.stringify(JSON.stringify(rows))});\n`,
    });
    writeFileSync(join(root, 'keep.txt'), 'x');
    expect(run('check', '-C', root).code).toBe(0);
    expect(existsSync(join(root, 'dist'))).toBe(false);
    expect(existsSync(join(root, 'node_modules/.cache/foldkit-dash/units.json'))).toBe(true);
  });
});

describe('interactive pages', () => {
  const page = [
    '# Units\n',
    '```input\n{ "type": "select", "name": "region", "options": ["north", "south"] }\n```\n',
    fence({ ...bars('units.json'), where: { region: { input: 'region' } } }),
  ].join('\n');

  test('build writes the page script once, named by its hash, and builds byte for byte the same', () => {
    const root = project({ 'pages/index.md': page, 'data/units.json': JSON.stringify(rows) });
    const built = run('build', '-C', root, '--json');
    expect(built.code).toBe(0);
    const written = envelopeOf(built.out).written;
    expect(written[0]).toBe('dist/index.html');
    expect(written[1]).toMatch(/^dist\/_dash\/client-[0-9a-f]{12}\.js$/);
    const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
    const script = written[1]?.replace('dist/', '') ?? '';
    expect(html).toContain(`<script defer src="${script}"></script>`);
    expect(html).toContain('data-foldkit-app');
    expect(html).toContain(`data-foldkit-build="${/client-([0-9a-f]+)/.exec(script)?.[1]}"`);
    expect(run('build', '-C', root).code).toBe(0);
    expect(readFileSync(join(root, 'dist/index.html'), 'utf8')).toBe(html);
  });

  test('describe names the input values a chart is drawn at, and the envelope lists inputs', () => {
    const root = project({ 'pages/index.md': page, 'data/units.json': JSON.stringify(rows) });
    const text = run('describe', '-C', root);
    expect(text.out).toStartWith('pages/index.md:7 [region = "north"] Shows 2 bars.');
    expect(envelopeOf(run('check', '-C', root, '--json').out).inputs).toEqual([
      {
        file: 'pages/index.md',
        line: 3,
        name: 'region',
        type: 'select',
        value: 'north',
        choices: 2,
      },
    ]);
  });
});
