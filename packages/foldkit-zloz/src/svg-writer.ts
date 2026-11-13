import { resolveEdgeGeometry, type ZlozEdgeGeometry } from './edge-geometry';
import { edgeEndpoints, portPosition } from './geometry';
import { ZlozError } from './graph';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Core node shape geometry describes domain outlines.
import { nodeShapeGeometry as nodeOutlineGeometry } from './node-shape';
import {
  planSvgExport,
  portablePaint,
  type ZlozSvgExportOptions,
  type ZlozSvgExportPlan,
  type ZlozSvgFinding,
  type ZlozSvgTarget,
} from './svg-export';
import {
  prepareSvgFontResource,
  type ZlozSvgFontResource,
  type ZlozSvgFontFailureCode,
} from './svg-font';
import { prepareSvgFontCoverage, type PreparedSvgFontCoverage } from './svg-font-coverage';
import type { EdgeRoute, LayoutLabelBox, Point, ZlozSnapshot, ZlozNode, ZlozEdge } from './types';

type Paint = Readonly<{ fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }>;
/** Safe vector vocabulary; no markup, CSS, IDs, URL references, scripts or foreignObject. */
export type ZlozSvgPrimitive =
  | (Paint &
      Readonly<{ type: 'rect'; position: Point; width: number; height: number; radius?: number }>)
  | (Paint & Readonly<{ type: 'circle'; center: Point; radius: number }>)
  | (Paint & Readonly<{ type: 'line'; from: Point; to: Point }>)
  | (Paint & Readonly<{ type: 'polygon' | 'polyline'; points: readonly Point[] }>)
  | (Paint &
      Readonly<{
        type: 'text';
        position: Point;
        text: string;
        anchor?: 'start' | 'middle' | 'end';
        baseline?: 'alphabetic' | 'middle';
        size?: number;
        weight?: number;
      }>)
  | Readonly<{ type: 'group'; translate?: Point; children: readonly ZlozSvgPrimitive[] }>;
export type ZlozSvgAdapterContext = Readonly<{
  theme: ZlozSvgExportPlan['theme'];
  font: ZlozSvgExportPlan['font'];
}> &
  (
    | Readonly<{ kind: 'node'; node: ZlozNode }>
    | Readonly<{
        kind: 'edge';
        edge: ZlozEdge;
        source: Point;
        target: Point;
        /** Effective retained route; absent when authored geometry takes precedence. */
        layoutRoute: EdgeRoute | undefined;
        labelBox: LayoutLabelBox | undefined;
        geometry: ZlozEdgeGeometry;
      }>
  );
export type ZlozSvgAdapter = Readonly<{
  id: string;
  version: string;
  render: (context: ZlozSvgAdapterContext) => readonly ZlozSvgPrimitive[];
}>;
export type ZlozSvgWriteOptions = Readonly<{
  adapters?: readonly ZlozSvgAdapter[];
  fontResources?: readonly ZlozSvgFontResource[];
  maxFontBytes?: number;
  allowLosses?: boolean;
  idPrefix?: string;
  maxPrimitives?: number;
  maxDepth?: number;
  maxCharacters?: number;
}>;
export type ZlozSvgWriteFinding = Readonly<
  Omit<ZlozSvgFinding, 'code'> & {
    code:
      | ZlozSvgFinding['code']
      | 'layout-writer-unsupported'
      | 'adapter-missing'
      | 'adapter-failed'
      | ZlozSvgFontFailureCode
      | 'font-cmap-invalid'
      | 'font-text-invalid'
      | 'font-coverage-limit'
      | 'font-glyph-missing'
      | 'font-coverage-unverified'
      | 'font-resource-missing'
      | 'font-resource-unexpected'
      | 'resource-unsupported'
      | 'loss-consent-required'
      | 'svg-output-invalid'
      | 'semantic-edge-fallback';
    codePoints?: readonly number[];
  }
>;
export type ZlozSvgWriteResult = Readonly<{
  plan: ZlozSvgExportPlan;
  findings: readonly ZlozSvgWriteFinding[];
}> &
  (Readonly<{ type: 'written'; svg: string }> | Readonly<{ type: 'blocked' }>);
function invalid(message: string): never {
  throw new ZlozError('invalid-edit', message);
}
function xml(value: string): string {
  for (const char of value) {
    const code = char.codePointAt(0);
    if (
      code === undefined ||
      !(
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      )
    )
      invalid('Text contains a character that XML 1.0 cannot represent.');
  }
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}
function finite(value: number): number {
  if (!Number.isFinite(value)) invalid('SVG coordinates must be finite.');
  return value;
}
function positive(value: number): number {
  if (finite(value) <= 0) invalid('SVG dimensions must be positive.');
  return value;
}
function point(value: Point): string {
  return `${finite(value.x)},${finite(value.y)}`;
}
function freeze<T>(value: T): T {
  if (isObject(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
function textFamily(value: string): string {
  if (['serif', 'sans-serif', 'monospace', 'system-ui'].includes(value)) return value;
  return `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;
}
function paint(value: Paint, text = false): string {
  const fill = value.fill ?? (text ? '#172033' : 'none'),
    stroke = value.stroke ?? 'none';
  if (!portablePaint(fill) || !portablePaint(stroke))
    invalid('SVG primitives require supported literal paints.');
  const width = value.strokeWidth ?? 1;
  if (finite(width) < 0) invalid('Stroke width must be non-negative.');
  const opacity = value.opacity ?? 1;
  if (finite(opacity) < 0 || opacity > 1) invalid('Opacity must be between zero and one.');
  return `fill="${xml(fill)}" stroke="${xml(stroke)}" stroke-width="${width}" opacity="${opacity}"`;
}
function checkedKeys(value: ZlozSvgPrimitive, keys: readonly string[]) {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) invalid(`Unsupported SVG primitive field: ${key}`);
}
function budget(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    invalid(`${name} must be a positive safe integer.`);
  return value;
}
function primitiveWriter(
  options: ZlozSvgWriteOptions,
  font: ZlozSvgExportPlan['font'],
  textColor: string,
  onText: (text: string) => void,
) {
  const max = budget(options.maxPrimitives ?? 10000, 'maxPrimitives'),
    depth = budget(options.maxDepth ?? 32, 'maxDepth');
  let count = 0;
  const reserve = (amount: number) => {
    count += amount;
    if (count > max) invalid('SVG primitive budget exceeded.');
  };
  const drawing = ['type', 'fill', 'stroke', 'strokeWidth', 'opacity'];
  const render = (value: ZlozSvgPrimitive, level = 0): string => {
    reserve(1);
    if (level > depth) invalid('SVG depth budget exceeded.');
    switch (value.type) {
      case 'group':
        checkedKeys(value, ['type', 'translate', 'children']);
        if (!Array.isArray(value.children)) invalid('Group children must be an array.');
        return `<g${value.translate ? ` transform="translate(${point(value.translate)})"` : ''}>${value.children.map((child) => render(child, level + 1)).join('')}</g>`;
      case 'rect':
        checkedKeys(value, [...drawing, 'position', 'width', 'height', 'radius']);
        if (finite(value.radius ?? 0) < 0) invalid('SVG corner radius must be non-negative.');
        return `<rect x="${finite(value.position.x)}" y="${finite(value.position.y)}" width="${positive(value.width)}" height="${positive(value.height)}" rx="${value.radius ?? 0}" ${paint(value)}/>`;
      case 'circle':
        checkedKeys(value, [...drawing, 'center', 'radius']);
        return `<circle cx="${finite(value.center.x)}" cy="${finite(value.center.y)}" r="${positive(value.radius)}" ${paint(value)}/>`;
      case 'line':
        checkedKeys(value, [...drawing, 'from', 'to']);
        return `<line x1="${finite(value.from.x)}" y1="${finite(value.from.y)}" x2="${finite(value.to.x)}" y2="${finite(value.to.y)}" ${paint(value)}/>`;
      case 'polygon':
      case 'polyline':
        checkedKeys(value, [...drawing, 'points']);
        if (
          !Array.isArray(value.points) ||
          value.points.length < (value.type === 'polygon' ? 3 : 2)
        )
          invalid('SVG point lists are incomplete.');
        return `<${value.type} points="${value.points.map(point).join(' ')}" ${paint(value)}/>`;
      case 'text': {
        const text = value.text;
        onText(text);
        checkedKeys(value, [
          ...drawing,
          'position',
          'text',
          'anchor',
          'baseline',
          'size',
          'weight',
        ]);
        const anchor = value.anchor ?? 'start';
        if (!['start', 'middle', 'end'].includes(anchor)) invalid('Invalid SVG text anchor.');
        if (value.baseline !== undefined && !['alphabetic', 'middle'].includes(value.baseline))
          invalid('Invalid SVG text baseline.');
        const baseline =
          value.baseline === undefined ? '' : ` dominant-baseline="${value.baseline}"`;
        const size = positive(value.size ?? font.size),
          weight = value.weight ?? font.weight;
        if (finite(weight) < 1 || weight > 1000) invalid('Invalid SVG font weight.');
        return `<text x="${finite(value.position.x)}" y="${finite(value.position.y)}" text-anchor="${anchor}"${baseline} font-size="${size}" font-weight="${weight}" ${paint({ ...value, fill: value.fill ?? textColor }, true)}>${text
          .split(/\r\n|\r|\n/u)
          .map(
            (line, index) =>
              `<tspan x="${value.position.x}" dy="${index === 0 ? 0 : size * 1.25}">${xml(line)}</tspan>`,
          )
          .join('')}</text>`;
      }
      default:
        return invalid('Unsupported SVG primitive.');
    }
  };
  return { render, reserve };
}
function path(value: string): string {
  if (value.includes('NaN') || value.includes('Infinity'))
    invalid('Canonical path geometry overflowed.');
  return xml(value);
}
function lines(node: ZlozNode): string[] {
  const a = node.architecture;
  if (!a) return [node.label];
  return [
    node.label,
    `[${a.family}: ${a.role}]`,
    ...('technology' in a && a.technology ? [a.technology] : []),
    ...('scope' in a && a.scope ? [a.scope] : []),
    ...('subdomain' in a && a.subdomain ? [a.subdomain] : []),
    ...(a.description ? [a.description] : []),
  ];
}
/** ADR 0076: keep SVG route/anchor precedence identical to native rendering. */
function retainedGeometry(plan: ZlozSvgExportPlan, edge: ZlozEdge) {
  const layoutRoute =
    !edge.waypoints && edge.pathStyle === undefined
      ? plan.layout?.routes.find((route) => route.id === edge.id)
      : undefined;
  const labelBox = layoutRoute?.label;
  const geometry = resolveEdgeGeometry(plan.graph, edge, {
    route: layoutRoute?.points,
    labelPosition: labelBox?.position,
  });
  return { layoutRoute, labelBox, geometry };
}
/** Fresh planning and immutable callback context; no DOM or file IO. */
export function writeSvgExport(
  snapshot: ZlozSnapshot,
  options: ZlozSvgExportOptions,
  writing: ZlozSvgWriteOptions = {},
): ZlozSvgWriteResult {
  const plan = freeze(planSvgExport(snapshot, options));
  const findings: ZlozSvgWriteFinding[] = [...plan.findings];
  const add = (
    code: ZlozSvgWriteFinding['code'],
    target: ZlozSvgFinding['target'],
    reason: string,
  ) => findings.push({ code, severity: 'unsupported', target, reason });
  const prefix = writing.idPrefix ?? 'zloz-export';
  if (!/^[A-Za-z_][\w.-]*$/u.test(prefix)) invalid('SVG idPrefix must be an XML-safe identifier.');
  const maxCharacters = budget(writing.maxCharacters ?? 2000000, 'maxCharacters');
  const adapters = new Map<string, ZlozSvgAdapter>();
  for (const adapter of writing.adapters ?? []) {
    const key = `${adapter.id.length}:${adapter.id}${adapter.version}`;
    if (!adapter.id.trim() || !adapter.version.trim() || adapters.has(key))
      invalid('Adapters need unique non-blank ID/version pairs.');
    adapters.set(key, adapter);
  }
  let fontCoverage: PreparedSvgFontCoverage | null = null;
  let fontStyle = '',
    embeddedFamily: string | null = null;
  const resources = new Map<string, ZlozSvgFontResource>();
  for (const resource of writing.fontResources ?? []) {
    if (
      resources.has(resource.assetId) ||
      resource.assetId !== plan.font.assetId ||
      !plan.assets.some(
        (a) => a.id === resource.assetId && a.kind === 'font' && a.availability === 'embedded',
      )
    ) {
      add(
        'font-resource-unexpected',
        { kind: 'asset', id: resource.assetId },
        'Font bytes must bind uniquely to the selected embedded font asset.',
      );
    } else resources.set(resource.assetId, resource);
  }
  for (const asset of plan.assets) {
    if (asset.availability !== 'embedded') continue;
    if (asset.kind !== 'font' || asset.id !== plan.font.assetId) {
      add(
        'resource-unsupported',
        { kind: 'asset', id: asset.id },
        'Only the selected embedded TrueType font has a byte-resource adapter; images and stylesheets remain unsupported.',
      );
      continue;
    }
    const resource = resources.get(asset.id);
    if (!resource) {
      add(
        'font-resource-missing',
        { kind: 'asset', id: asset.id },
        'Supply bytes for the selected embedded font asset.',
      );
      continue;
    }
    const validation = prepareSvgFontResource(
      resource,
      writing.maxFontBytes === undefined ? {} : { maxBytes: writing.maxFontBytes },
    );
    if (validation.type === 'invalid') {
      add(validation.code, { kind: 'asset', id: asset.id }, validation.reason);
      continue;
    }
    fontCoverage = prepareSvgFontCoverage(validation.bytes);
    if (fontCoverage.type === 'invalid') {
      add(fontCoverage.code, { kind: 'asset', id: asset.id }, fontCoverage.reason);
      continue;
    }
    if (fontCoverage.type === 'unverified')
      findings.push({
        code: 'font-coverage-unverified',
        severity: 'unverified',
        target: { kind: 'asset', id: asset.id },
        reason: fontCoverage.reason,
      });
    embeddedFamily = `${prefix}-font`;
    fontStyle = `<style>@font-face{font-family:'${embeddedFamily}';src:url(${validation.dataUrl}) format('truetype');font-weight:${validation.weight};font-style:normal;}</style>`;
    for (let index = 0; index < findings.length; index++) {
      const finding = findings[index];
      if (!finding) continue;
      if (
        finding.code === 'asset-unverified' &&
        finding.target.kind === 'asset' &&
        finding.target.id === asset.id
      )
        findings[index] = {
          ...finding,
          reason:
            'Embedded TrueType container/header checks passed; glyph programs, layout tables and browser decoding remain unverified.',
        };
      if (finding.code === 'font-unverified')
        findings[index] = {
          ...finding,
          reason:
            fontCoverage.type === 'ready'
              ? 'Default Unicode cmap mappings were checked; glyph programs, shaping, variation sequences, synthetic variants, wrapping and ink bounds remain unverified.'
              : 'Embedded TrueType bytes passed structural checks; glyph coverage, shaping, synthetic variants, wrapping and ink bounds remain unverified.',
        };
    }
  }
  for (const item of plan.items) {
    if (
      item.target.kind !== 'edge' ||
      (item.renderer.type !== 'built-in' && item.renderer.type !== 'fallback')
    )
      continue;
    const edge = plan.graph.edges.find((edge) => edge.id === item.target.id);
    if (edge?.architecture)
      findings.push({
        code: 'semantic-edge-fallback',
        severity: 'loss',
        target: item.target,
        reason: `The canonical arrow/plain label does not reproduce ${edge.architecture.family}/${edge.architecture.role} notation or side-role artwork. Supply a vector adapter or explicitly accept that loss.`,
      });
  }
  if (writing.allowLosses !== true && findings.some((f) => f.severity === 'loss'))
    add(
      'loss-consent-required',
      { kind: 'document' },
      'Set allowLosses explicitly to accept the reported fallback, approximation or omission.',
    );
  for (const item of plan.items)
    if (
      item.renderer.type === 'svg' &&
      !adapters.has(`${item.renderer.id.length}:${item.renderer.id}${item.renderer.version}`)
    )
      add(
        'adapter-missing',
        item.target,
        'A matching ID/version SVG primitive adapter is required.',
      );
  if (findings.some((f) => f.severity === 'unsupported'))
    return { type: 'blocked', plan, findings };
  let renderedText: string[] = [];
  const { render, reserve } = primitiveWriter(
      writing,
      plan.font,
      plan.theme.tokens.nodeColor,
      (text) => renderedText.push(text),
    ),
    t = plan.theme.tokens,
    width = plan.theme.edgeWidth ?? 1;
  const output = new Map<string, string>();
  const itemKey = (target: ZlozSvgTarget) => `${target.kind}:${target.id}`;
  for (const item of plan.items) {
    if (item.renderer.type === 'omit') {
      output.set(itemKey(item.target), '');
      continue;
    }
    renderedText = [];
    // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free core translates synchronous host adapter/XML failures into atomic blocked results.
    try {
      let artwork = '';
      if (item.renderer.type === 'svg') {
        const adapter = adapters.get(
          `${item.renderer.id.length}:${item.renderer.id}${item.renderer.version}`,
        );
        if (!adapter) invalid('Missing SVG adapter.');
        const node = plan.graph.nodes.find((n) => n.id === item.target.id),
          edge = plan.graph.edges.find((e) => e.id === item.target.id);
        const common = { theme: plan.theme, font: plan.font };
        let context: ZlozSvgAdapterContext;
        if (item.target.kind === 'node' && node) context = { ...common, kind: 'node', node };
        else if (item.target.kind === 'edge' && edge)
          context = {
            ...common,
            kind: 'edge',
            edge,
            ...edgeEndpoints(plan.graph, edge),
            ...retainedGeometry(plan, edge),
          };
        else invalid('Missing SVG adapter target.');
        const primitives = adapter.render(freeze(context));
        if (!Array.isArray(primitives) || primitives.length === 0)
          invalid(
            'SVG adapters must synchronously return a non-empty primitive array; use an omit declaration for intentional omission.',
          );
        artwork = primitives.map((p) => render(p)).join('');
      } else if (item.target.kind === 'node') {
        const node = plan.graph.nodes.find((n) => n.id === item.target.id);
        if (!node) invalid('Missing node.');
        const outline = nodeOutlineGeometry(node);
        reserve(1 + outline.decorationPaths.length);
        const fill =
          node.kind === 'group'
            ? t.groupBackground
            : node.architecture?.family === 'event-storming'
              ? {
                  command: t.eventStormingCommand,
                  'domain-event': t.eventStormingEvent,
                  policy: t.eventStormingPolicy,
                  actor: t.eventStormingActor,
                }[node.architecture.role]
              : t.nodeBackground;
        const labels = lines(node);
        const content = outline.contentBounds;
        artwork = `<g transform="translate(${point(node.position)})"><path d="${path(outline.outlinePath)}" fill="${xml(fill)}" stroke="${xml(t.nodeBorder)}" stroke-width="1.5"/>${outline.decorationPaths.map((d) => `<path d="${path(d)}" fill="none" stroke="${xml(t.nodeBorder)}"/>`).join('')}${labels.map((label, index) => render({ type: 'text', position: { x: content.x + 12, y: content.y + plan.font.size + 10 + index * plan.font.size * 1.25 }, text: label, fill: t.nodeColor, size: plan.font.size, weight: index === 0 ? Math.max(600, plan.font.weight) : plan.font.weight })).join('')}</g>`;
        for (const port of node.ports) {
          const at = portPosition(node, port.id);
          artwork += `<g data-zloz-export-port="${xml(port.id)}">${render({ type: 'circle', center: at, radius: 4, fill: port.kind === 'input' ? t.inputPort : t.outputPort, stroke: t.portBorder, strokeWidth: 1 })}${render({ type: 'text', position: { x: at.x + (port.kind === 'input' ? -9 : 9), y: at.y - 7 }, anchor: port.kind === 'input' ? 'end' : 'start', text: port.label ?? port.id, fill: t.nodeColor, size: plan.font.size, weight: plan.font.weight })}</g>`;
        }
      } else {
        const edge = plan.graph.edges.find((e) => e.id === item.target.id);
        if (!edge) invalid('Missing edge.');
        const { geometry, labelBox } = retainedGeometry(plan, edge);
        reserve(1);
        artwork = `<path d="${path(geometry.path)}" fill="none" stroke="${xml(t.edge)}" stroke-width="${width}" marker-end="url(#${prefix}-arrow)"/>`;
        if (edge.label && geometry.labelPosition)
          artwork += render({
            type: 'text',
            position: {
              x: geometry.labelPosition.x,
              y: labelBox
                ? geometry.labelPosition.y -
                  ((edge.label.split(/\r\n|\r|\n/u).length - 1) * plan.font.size * 1.25) / 2
                : geometry.labelPosition.y - 8,
            },
            baseline: labelBox ? 'middle' : undefined,
            text: edge.label,
            anchor: 'middle',
            fill: t.nodeColor,
            size: plan.font.size,
            weight: plan.font.weight,
          });
      }
      if (fontCoverage?.type === 'ready') {
        const missing = new Set<number>(),
          uncertain = new Set<number>();
        for (const text of renderedText) {
          const checked = fontCoverage.inspect(text, maxCharacters);
          if (checked.type === 'invalid') add(checked.code, item.target, checked.reason);
          if (checked.type === 'checked') {
            for (const cp of checked.missingCodePoints) missing.add(cp);
            for (const cp of checked.unverifiedCodePoints) uncertain.add(cp);
          }
        }
        const report = (
          points: Set<number>,
          code: 'font-glyph-missing' | 'font-coverage-unverified',
          severity: 'loss' | 'unverified',
        ) => {
          if (points.size === 0) return;
          const codePoints = [...points].sort((a, b) => a - b),
            shown = codePoints
              .slice(0, 16)
              .map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`)
              .join(', ');
          findings.push({
            code,
            severity,
            target: item.target,
            codePoints,
            reason:
              code === 'font-glyph-missing'
                ? `Embedded font has no default glyph for ${shown}${codePoints.length > 16 ? ' …' : ''}; ${codePoints.length} unique code point(s) may substitute or render as missing glyphs.`
                : `Sequence/default-ignorable characters ${shown} require shaping or variation handling; their coverage remains unverified.`,
          });
        };
        report(missing, 'font-glyph-missing', 'loss');
        report(uncertain, 'font-coverage-unverified', 'unverified');
      }
      output.set(
        itemKey(item.target),
        `<g data-zloz-export-${item.target.kind}="${xml(item.target.id)}">${artwork}</g>`,
      );
    } catch (error) {
      add(
        item.renderer.type === 'svg' ? 'adapter-failed' : 'svg-output-invalid',
        item.target,
        error instanceof Error ? error.message : 'SVG item rendering failed.',
      );
    }
  }
  if (findings.some((f) => f.severity === 'unsupported'))
    return { type: 'blocked', plan, findings };
  if (writing.allowLosses !== true && findings.some((f) => f.severity === 'loss')) {
    add(
      'loss-consent-required',
      { kind: 'document' },
      'Set allowLosses explicitly to accept the reported export losses.',
    );
    return { type: 'blocked', plan, findings };
  }
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free XML boundary reports document validation failures without partial output.
  try {
    const b = plan.viewBox;
    const depth = (node: ZlozNode) => {
      let n = node,
        level = 0;
      while (n.parentId) {
        const parent = plan.graph.nodes.find((p) => p.id === n.parentId);
        if (!parent) break;
        n = parent;
        level++;
      }
      return level;
    };
    const groups = plan.graph.nodes
      .filter((n) => n.kind === 'group')
      .sort((a, b) => depth(a) - depth(b));
    const ordered = [
      ...groups.map((n) => output.get(`node:${n.id}`) ?? ''),
      ...plan.graph.edges.map((e) => output.get(`edge:${e.id}`) ?? ''),
      ...plan.graph.nodes
        .filter((n) => n.kind !== 'group')
        .map((n) => output.get(`node:${n.id}`) ?? ''),
    ].join('');
    const background =
      plan.background === null
        ? ''
        : `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="${xml(plan.background)}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.size.width}" height="${plan.size.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" role="img" aria-labelledby="${prefix}-title ${prefix}-description" font-family="${xml(embeddedFamily ?? textFamily(plan.font.family))}"><title id="${prefix}-title">${xml(plan.title)}</title><desc id="${prefix}-description">${xml(plan.description)}</desc><defs>${fontStyle}<clipPath id="${prefix}-clip" clipPathUnits="userSpaceOnUse"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/></clipPath><marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" fill="${xml(t.edge)}"/></marker></defs><g clip-path="url(#${prefix}-clip)">${background}${ordered}</g></svg>`;
    if (svg.length > maxCharacters) invalid('SVG output character budget exceeded.');
    return { type: 'written', svg, plan, findings };
  } catch (error) {
    add(
      'svg-output-invalid',
      { kind: 'document' },
      error instanceof Error ? error.message : 'SVG document rendering failed.',
    );
    return { type: 'blocked', plan, findings };
  }
}
