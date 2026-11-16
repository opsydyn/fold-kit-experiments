import { ZlozError } from './graph';
import { captureGroupDocumentV3, type ZlozGroupDocumentV3 } from './group-document-v3';
import {
  resolveGroupSvgReviewV3,
  updateGroupSvgReviewV3,
  type ZlozGroupSvgReviewContextV3,
  type ZlozGroupSvgReviewControlsV3,
} from './group-svg-review-v3';
import {
  writeGroupSvgExportV3,
  captureGroupSvgLayoutV3,
  type ZlozGroupSvgExportOptionsV3,
  type ZlozGroupSvgWriteOptionsV3,
  type ZlozGroupSvgWriteResultV3,
} from './group-svg-v3';
import {
  planPngExport,
  resolvePngReviewProjection,
  updatePngReviewProjection,
  type ZlozPngExportOptions,
  type ZlozPngExportPlan,
  type ZlozPngReviewControls,
  type ZlozPngReviewState,
  type ZlozPngReviewRequest,
  type ZlozPngReviewUpdate,
  type ZlozPngArtifact,
} from './png-export';
import { ownPortableData } from './portable-data';
import type { ZlozSvgReviewIdentity } from './svg-review';

export type ZlozGroupPngExportInputV3 = Readonly<{
  document: ZlozGroupDocumentV3;
  svg: ZlozGroupSvgExportOptionsV3;
  writing?: ZlozGroupSvgWriteOptionsV3;
  png?: ZlozPngExportOptions;
  expectedSvg?: string;
}>;
export type ZlozGroupPngExportPlanV3 = ZlozPngExportPlan &
  Readonly<{ version: 3; document: ZlozGroupDocumentV3 }>;
export type ZlozGroupPngReviewContextV3 = Omit<ZlozGroupSvgReviewContextV3, 'fileName'> &
  Readonly<{ fileName?: string; png?: ZlozPngExportOptions }>;
export type ZlozGroupPngReviewControlsV3 = Omit<ZlozPngReviewControls, 'svg' | 'plan'> &
  Readonly<{ svg: ZlozGroupSvgReviewControlsV3; plan: ZlozGroupPngExportPlanV3 | null }>;
export type ZlozGroupPngRenderPayloadV3 = ZlozSvgReviewIdentity &
  Readonly<{
    run: number;
    input: ZlozGroupPngExportInputV3;
    plan: Extract<ZlozPngExportPlan, { type: 'ready' }>;
  }>;
export type ZlozGroupPngReviewUpdateV3 = Omit<ZlozPngReviewUpdate, 'payload'> &
  Readonly<{ payload: ZlozGroupPngRenderPayloadV3 | null }>;
function nativePlan(
  svg: ZlozGroupSvgWriteResultV3,
  options: ZlozPngExportOptions | undefined,
): ZlozGroupPngExportPlanV3 {
  return Object.freeze({ ...planPngExport(svg, options), version: 3, document: svg.plan.document });
}
/** Pure native planning through exactly the same validated SVG writer. Not permission to rasterize. */
export function planGroupPngExportV3(input: ZlozGroupPngExportInputV3): ZlozGroupPngExportPlanV3 {
  return nativePlan(writeGroupSvgExportV3(input.document, input.svg, input.writing), input.png);
}
/** Current native SVG/source/fidelity and raster budgets, using the shared PNG presentation contract. */
export function resolveGroupPngReviewV3(
  state: ZlozPngReviewState,
  context: ZlozGroupPngReviewContextV3,
): ZlozGroupPngReviewControlsV3 {
  const svg = resolveGroupSvgReviewV3(state.svg, { ...context, fileName: 'png-preview.svg' });
  return resolvePngReviewProjection(
    state,
    context.fileName,
    svg,
    svg.result ? nativePlan(svg.result, context.png) : null,
  );
}
function deferredInput(
  view: ZlozGroupPngReviewControlsV3,
  plan: Extract<ZlozPngExportPlan, { type: 'ready' }>,
  context: ZlozGroupPngReviewContextV3,
): ZlozGroupPngExportInputV3 {
  if (!view.svg.options || view.svg.result?.type !== 'written')
    throw new ZlozError('invalid-edit', 'Review native SVG before creating a PNG job.');
  const document = captureGroupDocumentV3(view.svg.result.plan.document);
  const { layout: _original, ...base } = view.svg.options;
  // SAFETY: Data-only options have already passed the native SVG planner; ownership freezes a detached job configuration.
  const options = ownPortableData(base, undefined, 'Native PNG SVG options') as Omit<
    ZlozGroupSvgExportOptionsV3,
    'layout'
  >;
  const retained = view.svg.result.plan.layout;
  const svg: ZlozGroupSvgExportOptionsV3 =
    retained === undefined
      ? options
      : {
          ...options,
          layout: Object.freeze({
            snapshot: captureGroupSvgLayoutV3(document, retained.routes, retained.renderKey),
            renderKey: retained.renderKey,
          }),
        };
  const { adapters, fontResources, ...limits } = context.writing ?? {};
  let writing: ZlozGroupSvgWriteOptionsV3 = { ...limits, allowLosses: true };
  if (adapters)
    writing = {
      ...writing,
      adapters: Object.freeze(
        adapters.map((adapter) =>
          Object.freeze({ id: adapter.id, version: adapter.version, render: adapter.render }),
        ),
      ),
    };
  if (fontResources)
    writing = {
      ...writing,
      fontResources: Object.freeze(
        fontResources.map((resource) =>
          Object.freeze({ ...resource, bytes: new Uint8Array(resource.bytes) }),
        ),
      ),
    };
  return Object.freeze({
    document,
    svg: Object.freeze(svg),
    writing: Object.freeze(writing),
    png: Object.freeze({ ...context.png }),
    expectedSvg: plan.svg,
  });
}
/** Bind trusted browser output metadata to its bounded data URL, not a general PNG import decoder. */
function artifactMatches(
  artifact: ZlozPngArtifact,
  plan: Extract<ZlozPngExportPlan, { type: 'ready' }>,
): boolean {
  const prefix = 'data:image/png;base64,';
  if (
    !artifact.dataUrl.startsWith(prefix) ||
    artifact.dataUrl.length !== prefix.length + Math.ceil(artifact.byteLength / 3) * 4
  )
    return false;
  const encoded = artifact.dataUrl.slice(prefix.length);
  // oxlint-disable-next-line linteffect/no-try-catch -- Validate bounded native base64 output at settlement; no DOM or IO is used.
  try {
    const bytes = globalThis.atob(encoded);
    if (bytes.length !== artifact.byteLength || globalThis.btoa(bytes) !== encoded) return false;
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    const word = (offset: number) =>
      bytes.charCodeAt(offset) * 0x1000000 +
      (bytes.charCodeAt(offset + 1) << 16) +
      (bytes.charCodeAt(offset + 2) << 8) +
      bytes.charCodeAt(offset + 3);
    return (
      signature.every((byte, i) => bytes.charCodeAt(i) === byte) &&
      word(8) === 13 &&
      word(12) === 0x49484452 &&
      word(16) === plan.width &&
      word(20) === plan.height
    );
  } catch {
    return false;
  }
}
/** Atomic review transitions; export never edits the source or Undo. Browser IO belongs to host Commands. */
export function updateGroupPngReviewV3(
  state: ZlozPngReviewState,
  context: ZlozGroupPngReviewContextV3,
  request: ZlozPngReviewRequest,
): ZlozGroupPngReviewUpdateV3 {
  return updatePngReviewProjection(state, context.scope, request, {
    resolve: () => resolveGroupPngReviewV3(state, context),
    settings: (view, preferences) =>
      updateGroupSvgReviewV3(
        state.svg,
        { ...context, fileName: 'png-preview.svg' },
        { ...view.svg.identity, type: 'SvgSettingsChanged', preferences },
      ),
    input: (view, plan) => deferredInput(view, plan, context),
    artifactMatches,
  });
}
