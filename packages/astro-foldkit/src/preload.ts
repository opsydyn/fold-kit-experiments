/**
 * Module preloads for FoldKit islands that boot at load.
 *
 * An island's JavaScript arrives as a chain: Astro's bootstrap fetches the
 * renderer and the component module, the component's `load` imports the
 * application, and each of those reveals its own imports only once it has
 * arrived. Astro emits no preload hints for island chunks, so every link of
 * the chain costs a round trip. For an island that boots at load, the whole
 * chain is known at build time; listing it in the head lets the browser fetch
 * it in parallel.
 *
 * Islands that defer their download (`client:visible`, `client:idle`,
 * `client:interaction`, `client:media`) are left alone: preloading them would
 * spend the bandwidth they were chosen to save.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ChunkNode = Readonly<{
  imports: ReadonlyArray<string>;
  dynamicImports: ReadonlyArray<string>;
  /** Whether this chunk is the entry of the astro-foldkit client renderer. */
  foldkitRenderer: boolean;
}>;

/** The client bundle's chunks by output file name, as Rollup reports them. */
export type ChunkGraph = ReadonlyMap<string, ChunkNode>;

/** Directives that boot an island as soon as the page loads. */
const eagerDirectives = new Set(['load', 'only']);

/**
 * The chunks an island needs to boot: the renderer, the component module, the
 * application its `load` imports, and everything those import statically.
 * What the application imports lazily stays lazy.
 */
export const islandPreloads = (
  graph: ChunkGraph,
  rendererFile: string,
  componentFile: string,
): ReadonlyArray<string> => {
  const files = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    const node = graph.get(file);
    if (node === undefined) return;
    files.add(file);
    for (const imported of node.imports) visit(imported);
  };
  visit(rendererFile);
  visit(componentFile);
  for (const loaded of graph.get(componentFile)?.dynamicImports ?? []) visit(loaded);
  return [...files];
};

const islandTag = /<astro-island\b[^>]*>/g;
const attribute = /\s([\w:-]+)="([^"]*)"/g;

const attributesOf = (tag: string): ReadonlyMap<string, string> =>
  new Map([...tag.matchAll(attribute)].map((match) => [match[1] ?? '', match[2] ?? '']));

/** Splits an island URL into the prefix Astro put before the chunk, the chunk's file name and any query. */
type ChunkUrl = Readonly<{ prefix: string; file: string; query: string }>;

const splitQuery = (url: string): readonly [string, string] => {
  const index = url.indexOf('?');
  return index === -1 ? [url, ''] : [url.slice(0, index), url.slice(index)];
};

const rendererUrl = (url: string, graph: ChunkGraph): ChunkUrl | undefined => {
  const [path, query] = splitQuery(url);
  for (const [file, node] of graph)
    if (node.foldkitRenderer && path.endsWith(`/${file}`))
      return { prefix: path.slice(0, -file.length), file, query };
  return undefined;
};

const componentFile = (url: string, renderer: ChunkUrl, graph: ChunkGraph): string | undefined => {
  const [path] = splitQuery(url);
  if (!path.startsWith(renderer.prefix)) return undefined;
  const file = path.slice(renderer.prefix.length);
  return graph.has(file) ? file : undefined;
};

/**
 * Adds `modulepreload` links for each FoldKit island on the page that boots at
 * load, at the end of the head so they follow the stylesheets: placed before
 * them, they compete with render-blocking CSS and delay first paint.
 *
 * Returns the page unchanged when it has no such island.
 */
export const addIslandPreloads = (html: string, graph: ChunkGraph): string => {
  const hrefs = new Set<string>();
  for (const [tag] of html.matchAll(islandTag)) {
    const attributes = attributesOf(tag);
    if (!eagerDirectives.has(attributes.get('client') ?? '')) continue;
    const renderer = rendererUrl(attributes.get('renderer-url') ?? '', graph);
    if (renderer === undefined) continue;
    const component = componentFile(attributes.get('component-url') ?? '', renderer, graph);
    if (component === undefined) continue;
    for (const file of islandPreloads(graph, renderer.file, component))
      hrefs.add(`${renderer.prefix}${file}${renderer.query}`);
  }
  const links = [...hrefs]
    .filter((href) => !html.includes(`rel="modulepreload" href="${href}"`))
    .map((href) => `<link rel="modulepreload" href="${href}">`)
    .join('');
  const head = html.indexOf('</head>');
  return links === '' || head === -1 ? html : html.slice(0, head) + links + html.slice(head);
};

type OutputChunk = Readonly<{
  type: 'chunk';
  fileName: string;
  imports: ReadonlyArray<string>;
  dynamicImports: ReadonlyArray<string>;
  facadeModuleId: string | null;
}>;
/** Rollup's output options, which the plugin does not read. */
export interface OutputOptions {}
type OutputBundle = Readonly<Record<string, OutputChunk | Readonly<{ type: 'asset' }>>>;
type BundleContext = Readonly<{
  environment?: Readonly<{ config: Readonly<{ consumer: string }> }>;
}>;

const normalizeId = (id: string): string => id.replaceAll('\\', '/');

export const chunkGraphOf = (bundle: OutputBundle, rendererEntry: string): ChunkGraph => {
  const entry = normalizeId(rendererEntry);
  const graph = new Map<string, ChunkNode>();
  for (const output of Object.values(bundle)) {
    if (output.type !== 'chunk') continue;
    graph.set(output.fileName, {
      imports: output.imports,
      dynamicImports: output.dynamicImports,
      foldkitRenderer:
        output.facadeModuleId !== null && normalizeId(output.facadeModuleId) === entry,
    });
  }
  return graph;
};

export type PreloadPlugin = Readonly<{
  name: 'astro-foldkit:preload';
  apply: 'build';
  generateBundle: (this: BundleContext, options: OutputOptions, bundle: OutputBundle) => void;
}>;

/** Records the client bundle's chunk graph for {@link writeIslandPreloads}. */
export const preloadPlugin = (
  rendererEntry: string,
  record: (graph: ChunkGraph) => void,
): PreloadPlugin => ({
  name: 'astro-foldkit:preload',
  apply: 'build',
  generateBundle(_options, bundle) {
    if (this.environment?.config.consumer !== 'client') return;
    record(chunkGraphOf(bundle, rendererEntry));
  },
});

const htmlFiles = async (directory: string): Promise<ReadonlyArray<string>> =>
  (await readdir(directory, { recursive: true, encoding: 'utf8' }))
    .filter((path) => path.endsWith('.html'))
    .map((path) => join(directory, path));

/**
 * Rewrites the pre-rendered pages under `directory` that boot a FoldKit island
 * at load. Pages rendered on request are not on disk and keep the chain.
 *
 * @returns the number of pages rewritten.
 */
export const writeIslandPreloads = async (
  directory: string,
  graph: ChunkGraph,
): Promise<number> => {
  let rewritten = 0;
  for (const file of await htmlFiles(directory)) {
    const html = await readFile(file, 'utf8');
    if (!html.includes('<astro-island')) continue;
    const updated = addIslandPreloads(html, graph);
    if (updated === html) continue;
    await writeFile(file, updated);
    rewritten += 1;
  }
  return rewritten;
};
