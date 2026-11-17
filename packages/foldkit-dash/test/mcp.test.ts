/** `foldkit-dash mcp`: the commands as MCP tools, driven through the SDK's own client. */
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Schema } from 'effect';

import { Envelope } from '../src/problems';
import type { Json } from '../src/rows';

const bin = join(import.meta.dir, '..', 'src', 'bin.ts');

/** A client connected to a fresh server, and the folder its project goes in. */
async function connect() {
  const client = new Client({ name: 'foldkit-dash-test', version: '0.0.0' });
  await client.connect(new StdioClientTransport({ command: 'bun', args: [bin, 'mcp'] }));
  return { client, site: join(mkdtempSync(join(tmpdir(), 'foldkit-dash-')), 'site') };
}

const ready = connect();

beforeAll(async () => {
  await ready;
});

afterAll(async () => {
  await (await ready).client.close();
});

/** A tool's text, and whether it failed. */
async function call(name: string, args: { readonly [key: string]: Json }) {
  const { client } = await ready;
  const result = await client.callTool({ name, arguments: args });
  const content = Schema.decodeUnknownSync(Schema.Array(Schema.Struct({ text: Schema.String })))(
    result.content,
  );
  return { text: content.map((part) => part.text).join(''), failed: result.isError === true };
}

const envelope = Schema.decodeUnknownSync(Schema.fromJsonString(Envelope));

test('the tools are listed', async () => {
  const { client } = await ready;
  const listed = await client.listTools();
  expect(listed.tools.map((tool) => tool.name)).toEqual([
    'dash_new',
    'dash_check',
    'dash_describe',
    'dash_preview',
    'dash_build',
  ]);
});

test('an agent starts, checks, describes at other values, previews and builds a project', async () => {
  const { site } = await ready;
  const started = await call('dash_new', { dir: site });
  expect(started.failed).toBe(false);
  expect(envelope(started.text).written).toContain('plot-spec.schema.json');
  writeFileSync(
    join(site, 'pages/region.md'),
    [
      '# One region\n',
      '```input\n{ "type": "select", "name": "region", "options": { "data": "sales.json", "field": "region" } }\n```\n',
      '```plot\n{ "width": 600, "height": 260, "data": "sales.json", "where": { "region": { "input": "region" } }, "marks": [{ "mark": "line", "x": "week", "y": "sales" }] }\n```\n',
    ].join('\n'),
  );
  const checked = envelope((await call('dash_check', { root: site })).text);
  expect(checked).toMatchObject({ status: 'ok', problems: [] });
  expect(checked.inputs.map((input) => input.name)).toEqual(['region']);

  const described = envelope(
    (await call('dash_describe', { root: site, at: { region: 'West' } })).text,
  );
  const chart = described.charts.find((each) => each.file === 'pages/region.md');
  expect(chart?.at).toEqual({ region: 'West' });
  expect(chart?.series.map((series) => series.name)).toEqual(['sales']);

  const preview = await call('dash_preview', {
    root: site,
    file: 'pages/region.md',
    line: 7,
    at: { region: 'East' },
  });
  expect(preview.failed).toBe(false);
  const shown = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ svg: Schema.String, summary: Schema.String })),
  )(preview.text);
  expect(shown.svg).toStartWith('<svg');
  expect(shown.summary).toStartWith('Shows 1 line.');

  const built = envelope((await call('dash_build', { root: site })).text);
  expect(built.written).toContain('dist/region.html');
  expect(existsSync(join(site, 'dist/region.html'))).toBe(true);
});

test('what cannot be done is an error the agent reads', async () => {
  const { site } = await ready;
  expect(await call('dash_check', { root: join(tmpdir(), 'no-dashboard-here') })).toMatchObject({
    failed: true,
  });
  expect(
    (await call('dash_preview', { root: site, file: 'pages/region.md', line: 2 })).text,
  ).toContain('no chart opens on pages/region.md:2 (charts open on lines 7)');
  expect((await call('dash_describe', { root: site, at: { zone: 1 } })).text).toBe(
    '--at zone: no page has an input of that name',
  );
  expect((await call('dash_build', { root: site, out: 'pages' })).failed).toBe(true);
  expect((await call('dash_check', { rooot: site })).failed).toBe(true);
  expect(await call('dash_nothing', {})).toEqual({
    text: 'no tool named dash_nothing',
    failed: true,
  });
});
