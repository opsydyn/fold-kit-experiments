/**
 * `foldkit-dash mcp` (ADR 0111): the commands as MCP tools over stdio, for agents that
 * call tools rather than run commands. Each tool takes a project folder and answers with
 * the `--json` envelope; `dash_preview` answers with one chart as a standalone SVG.
 * @module Mcp
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Effect, Result, Schema } from 'effect';

import manifest from '../package.json';
import { InputValue, Span } from './inputs';
import { encodeEnvelope, envelopeOf } from './problems';
import { analyse, type AskedValues, previewChart, type Report } from './project';
import { isOutputFolder, renderSite } from './site';
import { schemaFile, starter } from './template';

const root = { type: 'string', description: 'The project folder, holding pages/ and data/.' };
const fresh = { type: 'boolean', description: 'Run every data loader again (default false).' };
const at = {
  type: 'object',
  description:
    'Input values by name, instead of their defaults: { "region": "North", "floor": 10 }; null or "all" for a select\'s all; a list for checkboxes: { "regions": ["North", "Wales"] }; a span for between: { "weeks": { "min": "2026-06-01", "max": "2026-08-31" } }.',
  additionalProperties: {
    anyOf: [
      { type: ['string', 'number', 'boolean', 'null'] },
      { type: 'array', items: { type: ['string', 'number', 'boolean'] } },
      {
        type: 'object',
        properties: { min: { type: ['string', 'number'] }, max: { type: ['string', 'number'] } },
        required: ['min', 'max'],
      },
    ],
  },
};

/** The tools, as MCP lists them. */
export const tools = [
  {
    name: 'dash_new',
    description:
      'Start a project in a new or empty folder: a page, a data loader, AGENTS.md and the plot spec schema.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string' } }, required: ['dir'] },
  },
  {
    name: 'dash_check',
    description:
      'Every problem in a project, by file, line and spec path, and every chart and input. Writes nothing but the loader cache.',
    inputSchema: { type: 'object', properties: { root, fresh }, required: ['root'] },
  },
  {
    name: 'dash_describe',
    description:
      "What each chart shows, in words, with each series' points, low and high: at its inputs' defaults, or at the values given in `at`.",
    inputSchema: { type: 'object', properties: { root, fresh, at }, required: ['root'] },
  },
  {
    name: 'dash_preview',
    description:
      'One chart, by the page and the line its plot fence opens on, as a standalone SVG, with its summary and series, at its defaults or at `at`.',
    inputSchema: {
      type: 'object',
      properties: {
        root,
        file: { type: 'string', description: 'The page, such as pages/index.md.' },
        line: { type: 'integer', description: "The line the chart's ```plot fence opens on." },
        at,
      },
      required: ['root', 'file', 'line'],
    },
  },
  {
    name: 'dash_build',
    description: 'Build every page to static HTML in out (default dist), replacing what was there.',
    inputSchema: {
      type: 'object',
      properties: { root, fresh, out: { type: 'string', description: 'Default dist.' } },
      required: ['root'],
    },
  },
] as const;

const Asked = Schema.optionalKey(Schema.Record(Schema.String, InputValue));
const isSpan = Schema.is(Span);
const Fresh = Schema.optionalKey(Schema.Boolean);

const Arguments = {
  dash_new: Schema.Struct({ dir: Schema.String }),
  dash_check: Schema.Struct({ root: Schema.String, fresh: Fresh }),
  dash_describe: Schema.Struct({ root: Schema.String, fresh: Fresh, at: Asked }),
  dash_preview: Schema.Struct({
    root: Schema.String,
    file: Schema.String,
    line: Schema.Int,
    at: Asked,
  }),
  dash_build: Schema.Struct({
    root: Schema.String,
    fresh: Fresh,
    out: Schema.optionalKey(Schema.String),
  }),
};

/** A tool's answer: its text, and whether the call failed. */
type Answer = { readonly text: string; readonly failed: boolean };

const answer = (text: string): Answer => ({ text, failed: false });
const failure = (text: string): Answer => ({ text, failed: true });

const optionsFor = (args: { readonly root: string; readonly fresh?: boolean }) => ({
  root: resolve(args.root),
  fresh: args.fresh ?? false,
  timeout: 60_000,
});

/** `at` as the text `--at` would give: `all` for a select's `all`, a list comma-separated. */
const askedOf = (values: Readonly<Record<string, InputValue>> = {}): AskedValues =>
  new Map(
    Object.entries(values).map(([name, value]) => [
      name,
      value === null
        ? 'all'
        : Array.isArray(value)
          ? value.map(String).join(',')
          : isSpan(value)
            ? `${String(value.min)}..${String(value.max)}`
            : String(value),
    ]),
  );

const pagesOf = (report: Report) => report.pages.map((page) => page.file);

const reported = (command: 'check' | 'describe', report: Report): Answer =>
  answer(encodeEnvelope(envelopeOf(command, { ...report, pages: pagesOf(report) }, [])));

async function build(args: typeof Arguments.dash_build.Type): Promise<Answer> {
  const options = optionsFor(args);
  const folder = resolve(options.root, args.out ?? 'dist');
  if (!isOutputFolder(options.root, folder)) {
    return failure(
      'out must be a folder inside the project other than pages/, data/ or node_modules/',
    );
  }
  const report = analyse(options);
  if (Result.isFailure(report)) return failure(report.failure.message);
  const site = renderSite(report.success).pipe(
    Effect.match({ onFailure: (error) => Result.fail(error.message), onSuccess: Result.succeed }),
  );
  const files = await site.pipe(Effect.runPromise);
  if (Result.isFailure(files)) return failure(files.failure);
  rmSync(folder, { recursive: true, force: true });
  for (const file of files.success) {
    mkdirSync(dirname(join(folder, file.path)), { recursive: true });
    writeFileSync(join(folder, file.path), file.text);
  }
  const written = files.success.map((file) => relative(options.root, join(folder, file.path)));
  const pages = pagesOf(report.success);
  return answer(encodeEnvelope(envelopeOf('build', { ...report.success, pages }, written)));
}

async function started(args: typeof Arguments.dash_new.Type): Promise<Answer> {
  const folder = resolve(args.dir);
  if (existsSync(folder) && readdirSync(folder).length > 0)
    return failure(`${args.dir} is not empty: start a project in a new folder`);
  for (const [path, text] of starter) {
    mkdirSync(dirname(join(folder, path)), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
  const schema = await Bun.file(
    Bun.resolveSync('@opsydyn/foldkit-viz/plot-spec.schema.json', import.meta.dir),
  ).text();
  writeFileSync(join(folder, schemaFile), schema);
  const written = [...starter.map(([path]) => path), schemaFile];
  return answer(
    encodeEnvelope(
      envelopeOf(
        'new',
        { pages: ['pages/index.md'], problems: [], charts: [], inputs: [] },
        written,
      ),
    ),
  );
}

/** Runs one tool. */
export async function callTool(
  name: string,
  raw: CallToolRequest['params']['arguments'],
): Promise<Answer> {
  const decode = <A>(schema: Schema.Codec<A>) =>
    Result.mapError(Schema.decodeUnknownResult(schema)(raw ?? {}), (error) => error.message);
  if (name === 'dash_new') {
    const args = decode(Arguments.dash_new);
    return Result.isFailure(args) ? failure(args.failure) : started(args.success);
  }
  if (name === 'dash_check' || name === 'dash_describe') {
    const args = decode(Arguments.dash_describe);
    if (Result.isFailure(args)) return failure(args.failure);
    const report = analyse(optionsFor(args.success), askedOf(args.success.at));
    if (Result.isFailure(report)) return failure(report.failure.message);
    return reported(name === 'dash_check' ? 'check' : 'describe', report.success);
  }
  if (name === 'dash_preview') {
    const args = decode(Arguments.dash_preview);
    if (Result.isFailure(args)) return failure(args.failure);
    const { file, line } = args.success;
    const preview = previewChart(optionsFor(args.success), file, line, askedOf(args.success.at));
    if (Result.isFailure(preview)) return failure(preview.failure);
    return answer(JSON.stringify(preview.success));
  }
  if (name === 'dash_build') {
    const args = decode(Arguments.dash_build);
    return Result.isFailure(args) ? failure(args.failure) : build(args.success);
  }
  return failure(`no tool named ${name}`);
}

/** Serves the tools over stdio until the client closes; resolves then. */
export function serveMcp(): Promise<void> {
  const server = new Server(
    { name: 'foldkit-dash', version: manifest.version },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [...tools] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // A tool that throws (a disk error, say) answers as a failed call, not a lost one.
    const result = await callTool(request.params.name, request.params.arguments).catch((error) =>
      failure(error instanceof Error ? error.message : String(error)),
    );
    return { content: [{ type: 'text', text: result.text }], isError: result.failed };
  });
  return new Promise((done) => {
    server.onclose = () => done();
    void server.connect(new StdioServerTransport());
  });
}
