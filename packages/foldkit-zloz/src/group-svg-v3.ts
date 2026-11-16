import {
  editFields,
  editRecord,
  editIdentifier,
  editPoint,
  editSize,
  ownEditorEdit,
} from './edit-data';
import { portPosition } from './geometry';
import { ZlozError } from './graph';
import {
  captureGroupDocumentV3,
  serializeGroupDocumentV3,
  type ZlozGroupDocumentV3,
} from './group-document-v3';
import { planSvgProjection, type ZlozSvgExportOptions, type ZlozSvgExportPlan } from './svg-export';
import { copySvgRoutes, type ZlozSvgLayoutSnapshot } from './svg-layout';
import {
  writeSvgProjection,
  type ZlozSvgWriteOptions,
  type ZlozSvgWriteFinding,
  type ZlozSvgAdapterContext,
  type ZlozSvgPrimitive,
} from './svg-writer';
import type { EdgeRoute, JsonValue } from './types';

/** Native retained geometry always names its complete capability-aware source, never a bare graph. */
export type ZlozGroupSvgLayoutSnapshotV3 = ZlozSvgLayoutSnapshot &
  Readonly<{ version: 3; document: ZlozGroupDocumentV3 }>;
export type ZlozGroupSvgLayoutOptionsV3 = Readonly<{
  snapshot: ZlozGroupSvgLayoutSnapshotV3;
  renderKey: string;
}>;
export type ZlozGroupSvgExportOptionsV3 = Omit<ZlozSvgExportOptions, 'layout'> &
  Readonly<{ layout?: ZlozGroupSvgLayoutOptionsV3 }>;
/** Static graphic projection; document is the exact immutable source and graph aliases document.graph. */
export type ZlozGroupSvgExportPlanV3 = ZlozSvgExportPlan &
  Readonly<{ version: 3; document: ZlozGroupDocumentV3 }>;
export type ZlozGroupSvgAdapterContextV3 = ZlozSvgAdapterContext &
  Readonly<{ version: 3; document: ZlozGroupDocumentV3 }>;
export type ZlozGroupSvgAdapterV3 = Readonly<{
  id: string;
  version: string;
  render: (context: ZlozGroupSvgAdapterContextV3) => readonly ZlozSvgPrimitive[];
}>;
export type ZlozGroupSvgWriteOptionsV3 = Omit<ZlozSvgWriteOptions, 'adapters'> &
  Readonly<{ adapters?: readonly ZlozGroupSvgAdapterV3[] }>;
export type ZlozGroupSvgWriteResultV3 = Readonly<{
  plan: ZlozGroupSvgExportPlanV3;
  findings: readonly ZlozSvgWriteFinding[];
}> &
  (Readonly<{ type: 'written'; svg: string }> | Readonly<{ type: 'blocked' }>);
function routes(value: JsonValue): value is JsonValue & readonly EdgeRoute[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        editRecord(r) &&
        editFields(r, ['id', 'points'], ['label']) &&
        editIdentifier(r.id) &&
        Array.isArray(r.points) &&
        r.points.every(editPoint) &&
        (!Object.hasOwn(r, 'label') ||
          (editRecord(r.label) &&
            editFields(r.label, ['position', 'size']) &&
            editPoint(r.label.position) &&
            editSize(r.label.size))),
    )
  );
}
function ownedRoutes(
  document: ZlozGroupDocumentV3,
  input: readonly EdgeRoute[],
): readonly EdgeRoute[] {
  const owned = ownEditorEdit(input, routes, 'native SVG routes');
  copySvgRoutes(document.graph, owned);
  for (const route of owned) {
    const edge = document.graph.edges.find((e) => e.id === route.id)!;
    const anchors = [edge.source, edge.target].map((endpoint) =>
      portPosition(document.graph.nodes.find((n) => n.id === endpoint.node)!, endpoint.port),
    );
    const first = route.points[0]!,
      last = route.points.at(-1)!,
      start = anchors[0]!,
      end = anchors[1]!;
    if (
      Math.abs(first.x - start.x) > 1e-6 ||
      Math.abs(first.y - start.y) > 1e-6 ||
      Math.abs(last.x - end.x) > 1e-6 ||
      Math.abs(last.y - end.y) > 1e-6
    )
      throw new ZlozError('invalid-edit', 'Native SVG routes must join the authored port anchors.');
  }
  return owned;
}
/** Capture routes for an explicit full document. No editor mutation, IO or layout execution. */
export function captureGroupSvgLayoutV3(
  input: ZlozGroupDocumentV3,
  inputRoutes: readonly EdgeRoute[],
  renderKey: string,
): ZlozGroupSvgLayoutSnapshotV3 {
  if (!renderKey.trim())
    throw new ZlozError('invalid-edit', 'Provide a non-blank native SVG renderer key.');
  const document = captureGroupDocumentV3(input);
  return Object.freeze({
    version: 3,
    document,
    source: serializeGroupDocumentV3(document),
    renderKey,
    routes: ownedRoutes(document, inputRoutes),
  });
}
/** Validate complete v3 source before invoking shared, version-neutral SVG projection internals. */
export function planGroupSvgExportV3(
  input: ZlozGroupDocumentV3,
  options: ZlozGroupSvgExportOptionsV3,
): ZlozGroupSvgExportPlanV3 {
  const document = captureGroupDocumentV3(input);
  let configured: ZlozSvgExportOptions = options;
  if (options.layout) {
    const layout = options.layout.snapshot;
    if (
      layout.version !== 3 ||
      layout.source !== serializeGroupDocumentV3(captureGroupDocumentV3(layout.document))
    )
      throw new ZlozError(
        'invalid-edit',
        'Native SVG layout must retain its exact v3 document and source identity.',
      );
    configured = {
      ...options,
      layout: {
        renderKey: options.layout.renderKey,
        snapshot: { ...layout, routes: ownedRoutes(layout.document, layout.routes) },
      },
    };
  }
  const plan = planSvgProjection(document, configured, () => serializeGroupDocumentV3(document));
  return { ...plan, version: 3, document };
}
/** Fresh native planning and safe static vector writing. Unsupported findings never return partial markup. */
export function writeGroupSvgExportV3(
  document: ZlozGroupDocumentV3,
  options: ZlozGroupSvgExportOptionsV3,
  writing: ZlozGroupSvgWriteOptionsV3 = {},
): ZlozGroupSvgWriteResultV3 {
  const plan = planGroupSvgExportV3(document, options);
  const { adapters, ...limits } = writing;
  const mapped = adapters?.map((adapter) => ({
    id: adapter.id,
    version: adapter.version,
    render: (context: ZlozSvgAdapterContext) =>
      adapter.render(Object.freeze({ ...context, version: 3 as const, document: plan.document })),
  }));
  const configured: ZlozSvgWriteOptions =
    mapped === undefined ? limits : { ...limits, adapters: mapped };
  return writeSvgProjection(plan, configured, plan.document);
}
