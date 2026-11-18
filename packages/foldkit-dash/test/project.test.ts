import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Result } from 'effect';

import { type Input, queryOf, valuesFromQuery } from '../src/inputs';
import { fencesOf } from '../src/page';
import { analyse, type PagePlan, type Report } from '../src/project';
import { bars, fence, type Json, project, rows } from './support';

const options = (root: string, fresh = false, timeout = 60_000) => ({ root, fresh, timeout });

/** A static page's document (an interactive page has Flags instead). */
const htmlOf = (page: PagePlan | undefined): string => (page?._tag === 'Static' ? page.html : '');

const reportOf = (root: string, fresh = false, timeout = 60_000): Report => {
  const result = analyse(options(root, fresh, timeout));
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
};

/** A loader that counts its runs in `runs.txt` beside it, then prints `rows`. */
const countingLoader = `import { appendFileSync } from 'node:fs';
appendFileSync(new URL('runs.txt', import.meta.url), 'x');
console.log(JSON.stringify(${JSON.stringify(rows)}));
`;

const runsOf = (root: string): number =>
  existsSync(join(root, 'data/runs.txt'))
    ? readFileSync(join(root, 'data/runs.txt'), 'utf8').length
    : 0;

describe('analyse', () => {
  test('a chart from inline rows and one from a data file both draw and describe', () => {
    const page = `# Units\n\n${fence(bars(rows))}\n${fence(bars('units.json'))}`;
    const root = project({ 'pages/index.md': page, 'data/units.json': JSON.stringify(rows) });
    const report = reportOf(root);
    expect(report.problems).toEqual([]);
    const lines = fencesOf(page).map((found) => found.line);
    expect(lines[0]).toBe(3);
    expect(report.charts.map((chart) => chart.line)).toEqual(lines);
    expect(report.charts.every((chart) => chart.file === 'pages/index.md')).toBe(true);
    expect(report.charts[0]?.summary).toStartWith('Shows 3 bars.');
    const html = htmlOf(report.pages[0]) ?? '';
    expect(html.match(/<figure class="chart">/g)?.length).toBe(2);
    expect(html).not.toContain('<script');
  });

  test('every kind of problem is reported with its file, line and spec path', () => {
    const page = [
      '# Problems\n',
      '```plot\n{ "width": 400,\n```\n',
      '```plot\n[1, 2]\n```\n',
      fence({ ...bars(rows), marks: [{ mark: 'bar', x: 'month', y: 'revenue' }] }),
      fence(bars('missing.json')),
      fence(bars('../secrets.json')),
      fence(bars('broken.json')),
      fence(bars('words.json')),
    ].join('\n');
    const root = project({
      'pages/index.md': page,
      'data/broken.json.ts': 'console.error("no database"); process.exit(3);\n',
      'data/words.json': '{"not": "rows"}',
    });
    const problems = reportOf(root).problems;
    const found = fencesOf(page).map((each) => each.line);
    const lines = (i: number): number => found[i] ?? -1;
    expect(found.slice(0, 3)).toEqual([3, 7, 11]);
    expect(problems.map((problem) => [problem.kind, problem.line, problem.path])).toEqual([
      ['json', lines(0), null],
      ['json', lines(1), null],
      ['spec', lines(2), 'marks[0].y'],
      ['data', lines(3), null],
      ['data', lines(4), null],
      ['loader', lines(5), null],
      ['rows', lines(6), null],
    ]);
    expect(problems[2]?.message).toBe('marks[0].y: field "revenue" is missing from the data');
    expect(problems[3]?.message).toContain(
      'no data/missing.json, and no loader (data/missing.json.ts, .js, .py, .sh or .R)',
    );
    expect(problems[5]?.message).toBe('loader data/broken.json.ts exited with 3: no database');
    expect(problems.every((problem) => problem.file === 'pages/index.md')).toBe(true);
    // The page is still built, each problem shown where its chart would be.
    const html = htmlOf(reportOf(root).pages[0]) ?? '';
    expect(html.match(/class="problem"/g)?.length).toBe(7);
  });

  test('a loader runs once, then its cache serves until it changes or --fresh', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('units.json'))}\n${fence(bars('units.json'))}`,
      'data/units.json.ts': countingLoader,
    });
    expect(reportOf(root).problems).toEqual([]);
    expect(runsOf(root)).toBe(1);
    reportOf(root);
    expect(runsOf(root)).toBe(1);
    // --fresh runs it again, once for the build, though two fences use it.
    reportOf(root, true);
    expect(runsOf(root)).toBe(2);
    // A changed loader is newer than its cache.
    const later = new Date(Date.now() + 5000);
    utimesSync(join(root, 'data/units.json.ts'), later, later);
    reportOf(root);
    expect(runsOf(root)).toBe(3);
  });

  test('a data file wins over a loader of the same name, as in Observable Framework', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('units.json'))}`,
      'data/units.json': JSON.stringify(rows),
      'data/units.json.ts': countingLoader,
    });
    expect(reportOf(root).problems).toEqual([]);
    expect(runsOf(root)).toBe(0);
  });

  test('a loader that runs past its time is a problem, not a hang', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('slow.json'))}`,
      'data/slow.json.ts': 'await Bun.sleep(5000);\nconsole.log("[]");\n',
    });
    const started = performance.now();
    const problems = reportOf(root, false, 300).problems;
    expect(performance.now() - started).toBeLessThan(4000);
    expect(problems).toEqual([
      {
        kind: 'loader',
        file: 'pages/index.md',
        line: 3,
        path: null,
        message: 'loader data/slow.json.ts ran past 0.3 s',
      },
    ]);
  });

  test('pages in folders link to one another, and two builds are byte for byte the same', () => {
    const root = project({
      'pages/index.md': `# Home\n\nSee [north](teams/north.md).\n\n${fence(bars('units.json'))}`,
      'pages/teams/north.md': `# North\n\n${fence(bars('units.json'))}`,
      'pages/.draft.md': '# Hidden\n',
      'pages/notes.txt': 'not a page',
      'data/units.json.ts': countingLoader,
    });
    const first = reportOf(root);
    expect(first.pages.map((page) => [page.file, page.output, page.title])).toEqual([
      ['pages/index.md', 'index.html', 'Home'],
      ['pages/teams/north.md', 'teams/north.html', 'North'],
    ]);
    expect(htmlOf(first.pages[0])).toContain('href="teams/north.html"');
    expect(htmlOf(first.pages[1])).toContain('<a href="../index.html">Home</a>');
    const second = reportOf(root, true);
    expect(second.pages.map(htmlOf)).toEqual(first.pages.map(htmlOf));
  });

  test('a folder with no pages/ is not a project', () => {
    const result = analyse(options(project({ 'README.md': '# x' })));
    expect(Result.isFailure(result) && result.failure.message).toContain('has no pages/ folder');
  });

  test('a loader cannot reach outside data/', () => {
    const root = project({ 'pages/index.md': `# A\n\n${fence(bars('/etc/passwd'))}` });
    writeFileSync(join(root, 'secret.json'), JSON.stringify(rows));
    expect(reportOf(root).problems.map((problem) => problem.message)).toEqual([
      '"/etc/passwd" is not a file name inside data/',
    ]);
  });
});

describe('interactive pages', () => {
  const select = (extra: { readonly [key: string]: Json } = {}) =>
    `\`\`\`input\n${JSON.stringify({ type: 'select', name: 'region', options: { data: 'units.json', field: 'region' }, all: 'All', ...extra })}\n\`\`\`\n`;
  const filtered = (where: Json = { region: { input: 'region' } }) =>
    fence({ ...bars('units.json'), where });

  test('a page with an input is planned as an app, carrying only the rows its charts use', () => {
    const root = project({
      'pages/index.md': `# Units\n\nPick one.\n\n${select()}\n${filtered()}`,
      'pages/static.md': `# Still\n\n${fence(bars(rows))}`,
      'data/units.json': JSON.stringify(rows),
      'data/unused.json': JSON.stringify(rows),
    });
    const report = reportOf(root);
    expect(report.problems).toEqual([]);
    const [app, still] = report.pages;
    expect(still?._tag).toBe('Static');
    expect(app?._tag).toBe('App');
    const flags = app?._tag === 'App' ? app.flags : undefined;
    expect(Object.keys(flags?.data ?? {})).toEqual(['units.json']);
    expect(flags?.sections.map((section) => section._tag)).toEqual(['Prose', 'Control', 'Chart']);
    expect(report.inputs).toEqual([
      { file: 'pages/index.md', line: 5, name: 'region', type: 'select', value: null, choices: 3 },
    ]);
    expect(report.charts[0]).toMatchObject({ file: 'pages/index.md', at: { region: null } });
    expect(report.charts[0]?.summary).toStartWith('Shows 3 bars.');
    expect(report.chartCount).toBe(2);
  });

  test('where works on a static page too: one loader, a chart per part', () => {
    const root = project({
      'pages/index.md': `# North\n\n${filtered({ region: 'north' })}`,
      'data/units.json': JSON.stringify(rows),
    });
    const report = reportOf(root);
    expect(report.pages[0]?._tag).toBe('Static');
    expect(report.charts[0]?.summary).toStartWith('Shows 2 bars.');
  });

  test('input problems, references to no input, and choices that draw nothing are reported', () => {
    const page = [
      '# Bad\n',
      select({ options: ['north', 'south', 'west'] }),
      select({ options: ['north'] }),
      '```input\n{ "type": "radio", "name": "metric", "options": ["units"], "value": "profit" }\n```\n',
      filtered(),
      filtered({ region: { input: 'area' } }),
    ].join('\n');
    const root = project({
      'pages/index.md': page,
      'data/units.json': JSON.stringify(rows),
    });
    const problems = reportOf(root).problems;
    expect(problems.map((problem) => [problem.kind, problem.message])).toEqual([
      ['input', 'name: another input on this page is already called "region"'],
      ['input', 'value: "profit" is not one of the options'],
      ['data', 'with region = "west": where {"region":"west"} keeps no rows'],
      ['input', 'refers to no input "area" on this page'],
    ]);
  });
});

describe('loaders in any language, and CSV', () => {
  const csv = 'month,units,region\nJan,12,north\nFeb,9,south\nMar,15,north\n';

  test('a CSV file, and a Python or shell loader that prints CSV or JSON, all draw', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('units.csv'))}\n${fence(bars('py.json'))}\n${fence(bars('sh.tsv'))}`,
      'data/units.csv': csv,
      'data/py.json.py': `import json\nprint(json.dumps(${JSON.stringify(rows)}))\n`,
      'data/sh.tsv.sh': "printf 'month\\tunits\\nJan\\t12\\nFeb\\t9\\n'\n",
    });
    const report = reportOf(root);
    expect(report.problems).toEqual([]);
    expect(report.charts.map((chart) => chart.summary.split('.')[0])).toEqual([
      'Shows 3 bars',
      'Shows 3 bars',
      'Shows 2 bars',
    ]);
  });

  test('two loaders for one name, and a loader whose program is missing, are problems', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence(bars('twice.json'))}\n${fence(bars('r.json'))}`,
      'data/twice.json.ts': 'console.log("[]")\n',
      'data/twice.json.py': 'print("[]")\n',
      'data/r.json.R': 'cat("[]")\n',
    });
    const messages = reportOf(root).problems.map((problem) => [problem.kind, problem.message]);
    expect(messages[0]).toEqual([
      'loader',
      'data/twice.json.ts and data/twice.json.py both make twice.json: keep one',
    ]);
    // Rscript is not installed here; where it is, this loader prints an empty array.
    if (Bun.which('Rscript') === null) {
      expect(messages[1]).toEqual([
        'loader',
        'loader data/r.json.R runs with Rscript, which is not on the PATH',
      ]);
    }
  });
});

describe('describe at other values, and each series', () => {
  test('a series is reported with its points, low and high, and where each falls', () => {
    const root = project({
      'pages/index.md': `# A\n\n${fence({ width: 400, height: 240, data: 'units.json', marks: [{ mark: 'line', x: 'month', y: 'units', stroke: 'region' }] })}`,
      'data/units.json': JSON.stringify([...rows, { month: 'Apr', units: 12, region: 'north' }]),
    });
    // A low reached twice names both places, in the order the rows give them.
    expect(reportOf(root).charts[0]?.series).toEqual([
      { name: 'north', count: 3, low: { y: 12, x: ['Jan', 'Apr'] }, high: { y: 15, x: ['Mar'] } },
      { name: 'south', count: 1, low: { y: 9, x: ['Feb'] }, high: { y: 9, x: ['Feb'] } },
    ]);
  });

  test('bars are a series too: which category is highest and lowest, either way up', () => {
    const totals = [
      { region: 'north', units: 30 },
      { region: 'south', units: 12 },
      { region: 'east', units: 30 },
    ];
    const chart = (mark: Json) =>
      project({
        'pages/index.md': `# A\n\n${fence({ width: 400, height: 240, data: 'totals.json', marks: [mark] })}`,
        'data/totals.json': JSON.stringify(totals),
      });
    // A fill on the category axis colours bars; it does not split them into series.
    const upright = chart({ mark: 'bar', x: 'region', y: 'units', fill: 'region' });
    const highest = { y: 30, x: ['north', 'east'] };
    // Every bar, highest first; a tie keeps the rows' order.
    const ranked = [
      { x: 'north', y: 30 },
      { x: 'east', y: 30 },
      { x: 'south', y: 12 },
    ];
    const units = { name: 'units', count: 3, low: { y: 12, x: ['south'] }, high: highest, ranked };
    expect(reportOf(upright).charts[0]?.series).toEqual([units]);
    const sideways = chart({ mark: 'bar', x: 'units', y: 'region' });
    expect(reportOf(sideways).charts[0]?.series).toEqual([units]);
  });

  test('one series names the where that chose it; series follow color.domain', () => {
    const filtered = project({
      'pages/index.md': `# A\n\n${fence({ ...bars('units.json'), where: { region: 'north', units: { min: 10 } } })}`,
      'data/units.json': JSON.stringify(rows),
    });
    expect(reportOf(filtered).charts[0]?.series.map((series) => series.name)).toEqual([
      'units where region = north and units at least 10',
    ]);
    const ordered = project({
      'pages/index.md': `# A\n\n${fence({ width: 400, height: 240, data: 'units.json', color: { domain: ['south', 'north'] }, marks: [{ mark: 'line', x: 'month', y: 'units', stroke: 'region' }] })}`,
      'data/units.json': JSON.stringify(rows),
    });
    expect(reportOf(ordered).charts[0]?.series.map((series) => series.name)).toEqual([
      'south',
      'north',
    ]);
  });

  test('values asked for are used for description only, and are checked', () => {
    const page = `# A\n\n\`\`\`input\n{ "type": "select", "name": "region", "options": ["north", "south"] }\n\`\`\`\n\n${fence({ ...bars('units.json'), where: { region: { input: 'region' } } })}`;
    const root = project({ 'pages/index.md': page, 'data/units.json': JSON.stringify(rows) });
    const at = (values: ReadonlyArray<readonly [string, string]>) =>
      analyse(options(root), new Map(values));
    const south = at([['region', 'south']]);
    expect(Result.isSuccess(south) && south.success.charts[0]).toMatchObject({
      at: { region: 'south' },
    });
    expect(Result.isSuccess(south) && south.success.charts[0]?.summary).toStartWith('Shows 1 bar.');
    // The built page keeps its default.
    const plan = Result.isSuccess(south) ? south.success.pages[0] : undefined;
    expect(
      plan?._tag === 'App' && plan.flags.sections.find((each) => each._tag === 'Control'),
    ).toMatchObject({
      input: { value: 'north' },
    });
    const wrong = at([['region', 'west']]);
    expect(
      Result.isSuccess(wrong) && wrong.success.problems.map((problem) => problem.message),
    ).toEqual(['--at region=west: west is not one of its choices']);
    const unknown = at([['zone', '1']]);
    expect(Result.isFailure(unknown) && unknown.failure.message).toBe(
      '--at zone: no page has an input of that name',
    );
  });
});

describe('clicking a chart sets an input (ADR 0116)', () => {
  const regions = (choices: ReadonlyArray<string>) =>
    `\`\`\`input\n${JSON.stringify({ type: 'select', name: 'region', options: choices, all: 'All', value: null })}\n\`\`\`\n\n`;
  const totals = [
    { region: 'north', units: 27 },
    { region: 'south', units: 9 },
  ];
  const selecting = (spec: Readonly<Record<string, Json>>) =>
    fence({ width: 400, height: 240, data: 'totals.json', ...spec });
  const bySelect = { select: 'region', marks: [{ mark: 'bar', x: 'region', y: 'units' }] };

  test('a chart that selects an input says so, and highlights the chosen category', () => {
    const root = project({
      'pages/index.md': `# A\n\n${regions(['north', 'south'])}${selecting(bySelect)}`,
      'data/totals.json': JSON.stringify(totals),
    });
    const report = reportOf(root);
    expect(report.problems).toEqual([]);
    expect(report.charts[0]?.selects).toBe('region');
    const south = analyse(options(root), new Map([['region', 'south']]));
    expect(Result.isSuccess(south) && south.success.problems).toEqual([]);
  });

  test('select must name a select or radio whose choices hold every category', () => {
    const page = (input: string, spec: Readonly<Record<string, Json>>) => ({
      'pages/index.md': `# A\n\n${input}${selecting(spec)}`,
      'data/totals.json': JSON.stringify(totals),
    });
    const messages = (files: Record<string, string>) =>
      reportOf(project(files)).problems.map((problem) => [problem.kind, problem.message]);
    expect(messages(page(regions(['north']), bySelect))).toEqual([
      ['input', 'select: south is not a choice of "region"'],
    ]);
    const toggle = '```input\n{ "type": "checkbox", "name": "region", "value": false }\n```\n\n';
    expect(messages(page(toggle, bySelect))).toEqual([
      ['input', 'select: "region" is not a select or radio, so a click cannot choose it'],
    ]);
    expect(messages(page('', bySelect))).toEqual([
      ['input', 'select: no input "region" on this page'],
    ]);
    const line = { select: 'region', marks: [{ mark: 'line', x: 'units', y: 'units' }] };
    expect(messages(page(regions(['north', 'south']), line))).toEqual([
      ['spec', 'select: the chart has no axis of categories for a reader to click'],
    ]);
  });
});

describe('inputs in the query string (ADR 0116)', () => {
  const inputs: ReadonlyArray<Input> = [
    {
      _tag: 'Choose',
      name: 'region',
      label: 'Region',
      style: 'select',
      choices: ['north', 'south'],
      all: 'All',
      value: null,
    },
    { _tag: 'Range', name: 'min', label: 'Min', min: 0, max: 10, step: 1, value: 0 },
    { _tag: 'Toggle', name: 'smooth', label: 'Smooth', value: false },
  ];

  test('only values away from their defaults are written, and read back the same', () => {
    expect(queryOf(inputs, { region: null, min: 0, smooth: false })).toBe('');
    const query = queryOf(inputs, { region: 'south', min: 4, smooth: true });
    expect(query).toBe('?region=south&min=4&smooth=true');
    expect(valuesFromQuery(inputs, query)).toEqual({ region: 'south', min: 4, smooth: true });
  });

  test('anything a page cannot take is ignored, so an old link still opens it', () => {
    expect(valuesFromQuery(inputs, '?region=west&min=40&smooth=yes&utm_source=mail')).toEqual({});
    expect(valuesFromQuery(inputs, '?region=all&min=10')).toEqual({ region: null, min: 10 });
  });
});
