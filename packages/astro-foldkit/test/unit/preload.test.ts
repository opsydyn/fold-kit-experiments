import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import foldkit from '../../src/index';
import {
  addIslandPreloads,
  islandPreloads,
  type ChunkGraph,
  type OutputOptions,
} from '../../src/preload';

const chunk = (
  imports: ReadonlyArray<string> = [],
  dynamicImports: ReadonlyArray<string> = [],
  foldkitRenderer = false,
) => ({ imports, dynamicImports, foldkitRenderer });

// The shape planetnik's complexity page builds: the renderer and the page owner
// share FoldKit, and the owner's lazy `load` pulls in the app and its model.
const graph: ChunkGraph = new Map([
  ['_astro/client.R.js', chunk(['_astro/foldkit.F.js'], [], true)],
  ['_astro/react.X.js', chunk()],
  ['_astro/page.P.js', chunk(['_astro/helper.H.js', '_astro/foldkit.F.js'], ['_astro/main.M.js'])],
  ['_astro/app.A.js', chunk(['_astro/helper.H.js'], ['_astro/main.M.js'])],
  ['_astro/main.M.js', chunk(['_astro/model.D.js', '_astro/foldkit.F.js'], ['_astro/chart.C.js'])],
  ['_astro/model.D.js', chunk(['_astro/foldkit.F.js'])],
  ['_astro/helper.H.js', chunk()],
  ['_astro/foldkit.F.js', chunk()],
  ['_astro/chart.C.js', chunk(['_astro/foldkit.F.js'])],
]);

const island = (client: string, component = 'page.P', renderer = 'client.R', base = '/base') =>
  `<astro-island uid="Z1" component-url="${base}/_astro/${component}.js" component-export="default" renderer-url="${base}/_astro/${renderer}.js" props="{&quot;a&quot;:[0,&quot;x &gt; y&quot;]}" ssr client="${client}" opts="{&quot;name&quot;:&quot;Page&quot;}"><div></div></astro-island>`;

const page = (body: string, head = '<link rel="stylesheet" href="/base/_astro/site.css">') =>
  `<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

const preloadsIn = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((match) => match[1] ?? '');

describe('island preload set', () => {
  it('covers the renderer, the component and its lazy load, with their static imports', () => {
    expect([...islandPreloads(graph, '_astro/client.R.js', '_astro/page.P.js')].sort()).toEqual([
      '_astro/client.R.js',
      '_astro/foldkit.F.js',
      '_astro/helper.H.js',
      '_astro/main.M.js',
      '_astro/model.D.js',
      '_astro/page.P.js',
    ]);
  });

  it('leaves out what the loaded application itself imports lazily', () => {
    expect(islandPreloads(graph, '_astro/client.R.js', '_astro/page.P.js')).not.toContain(
      '_astro/chart.C.js',
    );
  });
});

describe('adding preloads to a built page', () => {
  it('preloads a client:load FoldKit island after the stylesheet, under the base path', () => {
    const html = addIslandPreloads(page(island('load')), graph);
    expect(preloadsIn(html)).toHaveLength(6);
    expect(preloadsIn(html)).toContain('/base/_astro/main.M.js');
    expect(html.indexOf('stylesheet')).toBeLessThan(html.indexOf('modulepreload'));
    expect(html.indexOf('modulepreload')).toBeLessThan(html.indexOf('</head>'));
  });

  it('preloads a client:only FoldKit island, which also boots at load', () => {
    expect(preloadsIn(addIslandPreloads(page(island('only')), graph))).toHaveLength(6);
  });

  it.each(['visible', 'idle', 'interaction', 'media'])(
    'leaves a client:%s island alone, since it defers its download on purpose',
    (client) => {
      const html = page(island(client));
      expect(addIslandPreloads(html, graph)).toBe(html);
    },
  );

  it('leaves islands of other renderers alone', () => {
    const html = page(island('load', 'page.P', 'react.X'));
    expect(addIslandPreloads(html, graph)).toBe(html);
  });

  it('leaves a page without islands untouched', () => {
    const html = page('<p>static</p>');
    expect(addIslandPreloads(html, graph)).toBe(html);
  });

  it('lists a chunk shared by two islands once', () => {
    const html = addIslandPreloads(page(island('load') + island('load', 'app.A')), graph);
    const hrefs = preloadsIn(html);
    expect(hrefs).toHaveLength(new Set(hrefs).size);
    expect(hrefs).toContain('/base/_astro/app.A.js');
  });

  it('does not repeat a preload the page already has', () => {
    const existing = '<link rel="modulepreload" href="/base/_astro/foldkit.F.js">';
    const html = addIslandPreloads(page(island('load'), existing), graph);
    expect(preloadsIn(html).filter((href) => href === '/base/_astro/foldkit.F.js')).toHaveLength(1);
  });

  it('keeps the query Astro appends to asset URLs, so each preload matches its import', () => {
    const html = page(island('load').replaceAll('.js"', '.js?dpl=abc"'));
    expect(preloadsIn(addIslandPreloads(html, graph))).toContain('/base/_astro/main.M.js?dpl=abc');
  });

  it('works with an absolute assets prefix', () => {
    const html = page(island('load', 'page.P', 'client.R', 'https://cdn.example.com'));
    expect(preloadsIn(addIslandPreloads(html, graph))).toContain(
      'https://cdn.example.com/_astro/model.D.js',
    );
  });

  it('skips an island whose component is not in the client bundle', () => {
    const html = page(island('load', 'missing.Q'));
    expect(addIslandPreloads(html, graph)).toBe(html);
  });
});

type BundleChunk = Readonly<{
  type: 'chunk';
  fileName: string;
  imports: ReadonlyArray<string>;
  dynamicImports: ReadonlyArray<string>;
  facadeModuleId: string | null;
}>;
type PreloadPlugin = {
  readonly name: string;
  readonly generateBundle?: (
    this: { readonly environment: { readonly config: { readonly consumer: string } } },
    options: OutputOptions,
    bundle: Readonly<Record<string, BundleChunk | { readonly type: 'asset' }>>,
  ) => void;
};

const rendererEntry = fileURLToPath(new URL('../../src/client.mjs', import.meta.url));

const setUp = (root: string) => {
  const updates: Array<{ readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }> = [];
  const integration = foldkit();
  // SAFETY: The test fixture supplies only the setup members the integration reads.
  integration.hooks['astro:config:setup']?.({
    config: { root: pathToFileURL(`${root}/`), srcDir: pathToFileURL(`${root}/src/`) },
    addClientDirective: () => {},
    addRenderer: () => {},
    updateConfig: (config: { readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }) => {
      updates.push(config);
    },
  } as never);
  // SAFETY: The test fixture establishes this value before the assertion.
  const plugins = (updates[0]?.vite?.plugins ?? []).flat(
    Number.POSITIVE_INFINITY,
  ) as ReadonlyArray<PreloadPlugin>;
  const plugin = plugins.find((candidate) => candidate.name === 'astro-foldkit:preload');
  if (plugin?.generateBundle === undefined) throw new Error('Expected the preload plugin');
  const done = integration.hooks['astro:build:done'];
  if (done === undefined) throw new Error('Expected astro:build:done hook');
  return { plugin, generateBundle: plugin.generateBundle, done };
};

const bundleChunk = (
  fileName: string,
  imports: ReadonlyArray<string> = [],
  dynamicImports: ReadonlyArray<string> = [],
  facadeModuleId: string | null = null,
): BundleChunk => ({ type: 'chunk', fileName, imports, dynamicImports, facadeModuleId });

const bundle = {
  '_astro/client.R.js': bundleChunk('_astro/client.R.js', [], [], rendererEntry),
  '_astro/page.P.js': bundleChunk('_astro/page.P.js', [], ['_astro/main.M.js']),
  '_astro/main.M.js': bundleChunk('_astro/main.M.js'),
  '_astro/site.css': { type: 'asset' as const },
};

describe('preloads written at the end of a build', () => {
  let root = '';
  const info: Array<string> = [];
  const logger = { info: (message: string) => info.push(message) };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'astro-foldkit-preload-'));
    info.length = 0;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (path: string, text: string): string => {
    const file = join(root, 'dist', path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    return file;
  };
  const buildDone = (done: ReturnType<typeof setUp>['done']) =>
    // SAFETY: The test fixture supplies only the members the hook reads.
    done({ dir: pathToFileURL(`${root}/dist/`), logger, pages: [], assets: new Map() } as never);

  it('adds preloads to the pages that boot a FoldKit island at load', async () => {
    const { generateBundle, done } = setUp(root);
    generateBundle.call({ environment: { config: { consumer: 'client' } } }, {}, bundle);
    const eager = write('units/index.html', page(island('load')));
    const lazy = write('index.html', page(island('visible')));
    const before = readFileSync(lazy, 'utf8');
    await buildDone(done);

    expect(preloadsIn(readFileSync(eager, 'utf8'))).toEqual([
      '/base/_astro/client.R.js',
      '/base/_astro/page.P.js',
      '/base/_astro/main.M.js',
    ]);
    expect(readFileSync(lazy, 'utf8')).toBe(before);
    expect(info.join('\n')).toContain('1 page');
  });

  it('reads the chunk graph from the client build only', async () => {
    const { generateBundle, done } = setUp(root);
    generateBundle.call({ environment: { config: { consumer: 'server' } } }, {}, bundle);
    const eager = write('index.html', page(island('load')));
    const before = readFileSync(eager, 'utf8');
    await buildDone(done);

    expect(readFileSync(eager, 'utf8')).toBe(before);
  });
});
