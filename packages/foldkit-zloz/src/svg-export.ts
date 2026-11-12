import { copyGraph, ZlozError } from './graph';
import { zlozLightTheme, zlozDarkTheme, type ZlozColorScheme } from './theme';
import type { Point, Size, ZlozGraph, ZlozSnapshot } from './types';

export type ZlozSvgBounds = Readonly<Point & Size>;
export type ZlozSvgRegion =
  | Readonly<{ type: 'model'; padding: number }>
  | Readonly<{ type: 'viewport'; size: Size }>
  | Readonly<{ type: 'bounds'; bounds: ZlozSvgBounds }>;
export type ZlozSvgTarget = Readonly<{ kind: 'node' | 'edge'; id: string }>;
/** Declarations, not executable markup or proof that a renderer has been qualified. */
export type ZlozSvgRenderer =
  | Readonly<{ type: 'built-in' }>
  | Readonly<{
      type: 'svg';
      id: string;
      version: string;
      bounds: ZlozSvgBounds;
      fidelity: 'equivalent' | 'approximate';
      reason: string;
    }>
  | Readonly<{ type: 'fallback' | 'omit' | 'unsupported'; reason: string }>;
export type ZlozSvgRendererOverride = Readonly<{
  target: ZlozSvgTarget;
  renderer: ZlozSvgRenderer;
}>;
/** Availability is host-declared; the planner never fetches or verifies resource bytes. */
export type ZlozSvgAsset = Readonly<{
  id: string;
  kind: 'image' | 'font' | 'stylesheet';
  availability: 'embedded' | 'external' | 'missing';
}>;
export type ZlozSvgFont = Readonly<{
  family: string;
  size: number;
  weight: number;
  assetId?: string;
}>;
export type ZlozSvgExportOptions = Readonly<{
  title: string;
  description?: string;
  region: ZlozSvgRegion;
  scale?: number;
  theme: Readonly<{ colorScheme: ZlozColorScheme; tokens?: ZlozSvgThemeTokens }>;
  background:
    | Readonly<{ type: 'theme' | 'transparent' }>
    | Readonly<{ type: 'color'; value: string }>;
  font: ZlozSvgFont;
  /** Required attestation for canonical defaults; unknown renderers block per item. */
  renderers: Readonly<{
    nodes: 'built-in' | 'unknown';
    edges: 'built-in' | 'unknown';
    overrides?: readonly ZlozSvgRendererOverride[];
  }>;
  assets?: readonly ZlozSvgAsset[];
}>;
export type ZlozSvgFinding = Readonly<{
  code:
    | 'bounds-estimated'
    | 'font-unverified'
    | 'theme-unresolved'
    | 'renderer-unsupported'
    | 'renderer-fallback'
    | 'renderer-omitted'
    | 'renderer-approximate'
    | 'renderer-unverified'
    | 'asset-unavailable'
    | 'asset-unverified'
    | 'omitted-endpoint';
  severity: 'loss' | 'unverified' | 'unsupported';
  target:
    | Readonly<{ kind: 'document' }>
    | Readonly<{ kind: 'node' | 'edge' | 'asset' | 'theme'; id: string }>;
  reason: string;
}>;
const paints = [
  'background',
  'nodeBackground',
  'nodeColor',
  'nodeBorder',
  'groupBackground',
  'inputPort',
  'outputPort',
  'portBorder',
  'edge',
  'eventStormingCommand',
  'eventStormingEvent',
  'eventStormingPolicy',
  'eventStormingActor',
] as const;
export type ZlozSvgPaint = (typeof paints)[number];
export type ZlozSvgThemeTokens = Readonly<Partial<Record<ZlozSvgPaint | 'edgeWidth', string>>>;
export type ZlozSvgExportPlan = Readonly<{
  format: 'svg';
  /** Reviewable is a planning result, never authorization to write a file or a fidelity guarantee. */
  type: 'reviewable' | 'blocked';
  title: string;
  description: string;
  graph: ZlozGraph;
  region: ZlozSvgRegion;
  contentBounds: ZlozSvgBounds;
  viewBox: ZlozSvgBounds;
  size: Size;
  clip: true;
  theme: Readonly<{
    colorScheme: ZlozColorScheme;
    tokens: Readonly<Record<ZlozSvgPaint, string>>;
    edgeWidth: number | null;
  }>;
  background: string | null;
  font: ZlozSvgFont;
  items: readonly ZlozSvgRendererOverride[];
  assets: readonly ZlozSvgAsset[];
  findings: readonly ZlozSvgFinding[];
}>;
function invalid(message: string): never {
  throw new ZlozError('invalid-edit', message);
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function text(value: string): string {
  if (!isString(value) || !value.trim())
    invalid('Export identifiers, titles and reasons must be non-blank.');
  return value;
}
function positive(value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    invalid('Export dimensions and scale must be positive and finite.');
  return value;
}
function bounds(value: ZlozSvgBounds): ZlozSvgBounds {
  positive(value.width);
  positive(value.height);
  if (![value.x, value.y, value.x + value.width, value.y + value.height].every(Number.isFinite))
    invalid('Export bounds must have finite extents.');
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}
function portablePaint(value: string): boolean {
  if (
    value === 'none' ||
    value === 'transparent' ||
    /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu.test(value)
  )
    return true;
  const rgb =
    /^rgb\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)(?: \/ (\d+(?:\.\d+)?))?\)$/u.exec(value);
  if (!rgb) return false;
  return (
    rgb.slice(1, 4).every((channel) => Number(channel) <= 255) &&
    (rgb[4] === undefined || Number(rgb[4]) <= 1)
  );
}
function renderer(value: ZlozSvgRenderer): ZlozSvgRenderer {
  switch (value.type) {
    case 'built-in':
      return { type: 'built-in' };
    case 'svg':
      if (value.fidelity !== 'equivalent' && value.fidelity !== 'approximate')
        invalid('Invalid SVG fidelity declaration.');
      return {
        type: 'svg',
        id: text(value.id),
        version: text(value.version),
        bounds: bounds(value.bounds),
        fidelity: value.fidelity,
        reason: text(value.reason),
      };
    case 'fallback':
    case 'omit':
    case 'unsupported':
      return { type: value.type, reason: text(value.reason) };
    default:
      return invalid('Unknown export renderer declaration.');
  }
}
function key(target: ZlozSvgTarget) {
  return `${target.kind}:${target.id}`;
}
function contentBounds(graph: ZlozGraph, items: readonly ZlozSvgRendererOverride[]): ZlozSvgBounds {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  const include = (x: number, y: number, width = 0, height = 0) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  };
  for (const node of graph.nodes)
    include(node.position.x, node.position.y, node.size.width, node.size.height);
  for (const edge of graph.edges)
    for (const bend of edge.waypoints ?? []) include(bend.position.x, bend.position.y);
  for (const item of items)
    if (item.renderer.type === 'svg') {
      const b = item.renderer.bounds;
      include(b.x, b.y, b.width, b.height);
    }
  return left === Infinity
    ? { x: 0, y: 0, width: 1, height: 1 }
    : bounds({
        x: left,
        y: top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      });
}
function targetEntry(kind: ZlozSvgTarget['kind'], id: string): readonly [string, ZlozSvgTarget] {
  const target = { kind, id };
  return [key(target), target];
}
function compareFindings(a: ZlozSvgFinding, b: ZlozSvgFinding) {
  const first = `${a.target.kind}:${'id' in a.target ? a.target.id : ''}:${a.code}`;
  const second = `${b.target.kind}:${'id' in b.target ? b.target.id : ''}:${b.code}`;
  return first < second ? -1 : first > second ? 1 : 0;
}
/** ADR 0052: pure canonical-model export planning; no DOM, SVG writer, IO or rasterization. */
export function planSvgExport(
  snapshot: ZlozSnapshot,
  options: ZlozSvgExportOptions,
): ZlozSvgExportPlan {
  const graph = copyGraph(snapshot.graph);
  const title = text(options.title);
  if (options.description !== undefined && !isString(options.description))
    invalid('Export description must be literal text.');
  const scale = positive(options.scale ?? 1);
  if (
    snapshot.viewport &&
    (![snapshot.viewport.x, snapshot.viewport.y].every(Number.isFinite) ||
      !Number.isFinite(snapshot.viewport.zoom) ||
      snapshot.viewport.zoom <= 0)
  )
    invalid('Export camera must be finite with positive zoom.');
  if (options.theme.colorScheme !== 'light' && options.theme.colorScheme !== 'dark')
    invalid('Export requires an explicit light or dark theme.');
  if (
    !['built-in', 'unknown'].includes(options.renderers.nodes) ||
    !['built-in', 'unknown'].includes(options.renderers.edges)
  )
    invalid('Export requires explicit renderer coverage.');
  const findings: ZlozSvgFinding[] = [];
  const add = (
    code: ZlozSvgFinding['code'],
    severity: ZlozSvgFinding['severity'],
    target: ZlozSvgFinding['target'],
    reason: string,
  ) => findings.push({ code, severity, target, reason });
  const base = options.theme.colorScheme === 'dark' ? zlozDarkTheme : zlozLightTheme;
  const tokens = {
    background: options.theme.tokens?.background ?? base.tokens.background,
    nodeBackground: options.theme.tokens?.nodeBackground ?? base.tokens.nodeBackground,
    nodeColor: options.theme.tokens?.nodeColor ?? base.tokens.nodeColor,
    nodeBorder: options.theme.tokens?.nodeBorder ?? base.tokens.nodeBorder,
    groupBackground: options.theme.tokens?.groupBackground ?? base.tokens.groupBackground,
    inputPort: options.theme.tokens?.inputPort ?? base.tokens.inputPort,
    outputPort: options.theme.tokens?.outputPort ?? base.tokens.outputPort,
    portBorder: options.theme.tokens?.portBorder ?? base.tokens.portBorder,
    edge: options.theme.tokens?.edge ?? base.tokens.edge,
    eventStormingCommand:
      options.theme.tokens?.eventStormingCommand ?? base.tokens.eventStormingCommand,
    eventStormingEvent: options.theme.tokens?.eventStormingEvent ?? base.tokens.eventStormingEvent,
    eventStormingPolicy:
      options.theme.tokens?.eventStormingPolicy ?? base.tokens.eventStormingPolicy,
    eventStormingActor: options.theme.tokens?.eventStormingActor ?? base.tokens.eventStormingActor,
  } satisfies Record<ZlozSvgPaint, string>;
  for (const token of paints) {
    text(tokens[token]);
    if (!portablePaint(tokens[token]))
      add(
        'theme-unresolved',
        'unsupported',
        { kind: 'theme', id: token },
        `Resolve ${token} to a supported literal paint before writing SVG.`,
      );
  }
  const width = Number(options.theme.tokens?.edgeWidth ?? base.tokens.edgeWidth);
  const edgeWidth = Number.isFinite(width) && width > 0 ? width : null;
  if (edgeWidth === null)
    add(
      'theme-unresolved',
      'unsupported',
      { kind: 'theme', id: 'edgeWidth' },
      'Resolve edgeWidth to a positive finite SVG width.',
    );
  let background: string | null = null;
  switch (options.background.type) {
    case 'transparent':
      break;
    case 'theme':
      background = tokens.background;
      break;
    case 'color':
      background = text(options.background.value);
      if (!portablePaint(background))
        add(
          'theme-unresolved',
          'unsupported',
          { kind: 'theme', id: 'exportBackground' },
          'Resolve export background to a supported literal paint.',
        );
      break;
    default:
      invalid('Unknown export background.');
  }
  const available = new Map<string, ZlozSvgTarget>([
    ...graph.nodes.map((node) => targetEntry('node', node.id)),
    ...graph.edges.map((edge) => targetEntry('edge', edge.id)),
  ]);
  const overrides = new Map<string, ZlozSvgRenderer>();
  for (const entry of options.renderers.overrides ?? []) {
    const id = key(entry.target);
    if (!available.has(id) || overrides.has(id))
      invalid('Renderer overrides require unique existing targets.');
    overrides.set(id, renderer(entry.renderer));
  }
  const items: ZlozSvgRendererOverride[] = [];
  for (const [id, target] of available) {
    const mode = target.kind === 'node' ? options.renderers.nodes : options.renderers.edges;
    const resolved =
      overrides.get(id) ??
      (mode === 'built-in'
        ? { type: 'built-in' as const }
        : {
            type: 'unsupported' as const,
            reason: 'No portable renderer was declared for this item.',
          });
    items.push({ target, renderer: resolved });
    if (resolved.type === 'svg') {
      add(
        'renderer-unverified',
        'unverified',
        target,
        `SVG renderer ${resolved.id}@${resolved.version} is host-declared, not qualified by this planner. ${resolved.reason}`,
      );
      if (resolved.fidelity === 'approximate')
        add('renderer-approximate', 'loss', target, resolved.reason);
    } else if (resolved.type === 'fallback')
      add('renderer-fallback', 'loss', target, resolved.reason);
    else if (resolved.type === 'omit') add('renderer-omitted', 'loss', target, resolved.reason);
    else if (resolved.type === 'unsupported')
      add('renderer-unsupported', 'unsupported', target, resolved.reason);
  }
  const omitted = new Set(
    items
      .filter((item) => item.target.kind === 'node' && item.renderer.type === 'omit')
      .map((item) => item.target.id),
  );
  for (const edge of graph.edges)
    if (
      (omitted.has(edge.source.node) || omitted.has(edge.target.node)) &&
      overrides.get(key({ kind: 'edge', id: edge.id }))?.type !== 'omit'
    )
      add(
        'omitted-endpoint',
        'loss',
        { kind: 'edge', id: edge.id },
        'This connection has an intentionally omitted node; its authored anchors remain in the model.',
      );
  const assets: ZlozSvgAsset[] = [];
  const assetIds = new Set<string>();
  for (const asset of options.assets ?? []) {
    text(asset.id);
    if (
      assetIds.has(asset.id) ||
      !['image', 'font', 'stylesheet'].includes(asset.kind) ||
      !['embedded', 'external', 'missing'].includes(asset.availability)
    )
      invalid('Invalid or duplicate export asset declaration.');
    assetIds.add(asset.id);
    assets.push({ id: asset.id, kind: asset.kind, availability: asset.availability });
    add(
      asset.availability === 'embedded' ? 'asset-unverified' : 'asset-unavailable',
      asset.availability === 'embedded' ? 'unverified' : 'unsupported',
      { kind: 'asset', id: asset.id },
      asset.availability === 'embedded'
        ? 'Embedded resource bytes still require writer validation.'
        : 'Portable export requires the resource to be supplied and embedded; the planner never fetches it.',
    );
  }
  text(options.font.family);
  positive(options.font.size);
  if (
    !Number.isFinite(options.font.weight) ||
    options.font.weight < 1 ||
    options.font.weight > 1000
  )
    invalid('Export font weight must be between 1 and 1000.');
  if (
    options.font.assetId !== undefined &&
    !assets.some((asset) => asset.id === options.font.assetId && asset.kind === 'font')
  )
    invalid('Font assetId must identify a declared font asset.');
  const fontBase = {
    family: options.font.family,
    size: options.font.size,
    weight: options.font.weight,
  };
  const font: ZlozSvgFont =
    options.font.assetId === undefined ? fontBase : { ...fontBase, assetId: options.font.assetId };
  if (graph.nodes.some((node) => node.label.length > 0) || graph.edges.some((edge) => edge.label))
    add(
      'font-unverified',
      'unverified',
      { kind: 'document' },
      options.font.assetId === undefined
        ? 'System fonts are not embedded; glyph substitution, text wrapping and ink bounds are unverified.'
        : 'Declared font bytes, glyph coverage, text wrapping and ink bounds require writer qualification.',
    );
  const content = contentBounds(graph, items);
  let region: ZlozSvgRegion;
  let viewBox: ZlozSvgBounds;
  let size: Size;
  switch (options.region.type) {
    case 'model': {
      const padding = options.region.padding;
      if (!Number.isFinite(padding) || padding < 0)
        invalid('Export padding must be finite and non-negative.');
      region = { type: 'model', padding };
      viewBox = bounds({
        x: content.x - padding,
        y: content.y - padding,
        width: content.width + 2 * padding,
        height: content.height + 2 * padding,
      });
      size = { width: positive(viewBox.width * scale), height: positive(viewBox.height * scale) };
      if (graph.nodes.length || graph.edges.length)
        add(
          'bounds-estimated',
          'unverified',
          { kind: 'document' },
          'Authored envelopes, bends and declared custom bounds exclude unmeasured text ink, strokes, port artwork, custom geometry and transient layout routes. Padding is explicit, not a fit guarantee.',
        );
      break;
    }
    case 'viewport': {
      const camera = snapshot.viewport;
      if (!camera) invalid('Viewport export requires an explicit camera.');
      const width = positive(options.region.size.width),
        height = positive(options.region.size.height);
      region = { type: 'viewport', size: { width, height } };
      viewBox = bounds({
        x: -camera.x / camera.zoom,
        y: -camera.y / camera.zoom,
        width: width / camera.zoom,
        height: height / camera.zoom,
      });
      size = { width: positive(width * scale), height: positive(height * scale) };
      break;
    }
    case 'bounds':
      viewBox = bounds(options.region.bounds);
      region = { type: 'bounds', bounds: { ...viewBox } };
      size = { width: positive(viewBox.width * scale), height: positive(viewBox.height * scale) };
      break;
    default:
      return invalid('Unknown export region.');
  }
  findings.sort(compareFindings);
  return {
    format: 'svg',
    type: findings.some((f) => f.severity === 'unsupported') ? 'blocked' : 'reviewable',
    title,
    description: options.description ?? '',
    graph,
    region,
    contentBounds: content,
    viewBox,
    size,
    clip: true,
    theme: { colorScheme: options.theme.colorScheme, tokens, edgeWidth },
    background,
    font,
    items,
    assets,
    findings,
  };
}
