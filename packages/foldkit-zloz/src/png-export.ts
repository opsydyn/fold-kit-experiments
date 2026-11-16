import { ZlozError, parseSnapshot, serializeSnapshot } from './graph';
import type { ZlozSvgExportOptions } from './svg-export';
import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  type ZlozSvgReviewState,
  type ZlozSvgReviewContext,
  type ZlozSvgReviewIdentity,
  type ZlozSvgReviewPreferences,
} from './svg-review';
import type { ZlozSvgWriteOptions, ZlozSvgWriteResult, ZlozSvgWriteFinding } from './svg-writer';
import type { ZlozSnapshot } from './types';
export type ZlozPngExportOptions = Readonly<{
  maxDimension?: number;
  maxPixels?: number;
  maxBytes?: number;
}>;
export type ZlozPngFinding =
  | ZlozSvgWriteFinding
  | Readonly<{
      code: 'rasterization-loss' | 'png-size-limit';
      severity: 'loss' | 'unsupported';
      target: Readonly<{ kind: 'document' }>;
      reason: string;
    }>;
export type ZlozPngExportPlan = Readonly<{
  width: number;
  height: number;
  maxBytes: number;
  findings: readonly ZlozPngFinding[];
}> &
  (Readonly<{ type: 'ready'; svg: string }> | Readonly<{ type: 'blocked' }>);
export type ZlozPngArtifact = Readonly<{
  dataUrl: string;
  byteLength: number;
  width: number;
  height: number;
}>;
export type ZlozPngRenderResult =
  | Readonly<{ type: 'rendered'; artifact: ZlozPngArtifact }>
  | Readonly<{ type: 'failed'; code: string; reason: string }>;
export type ZlozPngExportInput = Readonly<{
  snapshot: ZlozSnapshot;
  svg: ZlozSvgExportOptions;
  writing?: ZlozSvgWriteOptions;
  png?: ZlozPngExportOptions;
  expectedSvg?: string;
}>;
function budget(value: number | undefined, fallback: number, maximum: number, name: string) {
  const chosen = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(chosen) || chosen < 1 || chosen > maximum)
    throw new ZlozError('invalid-edit', `${name} must be an integer from 1 to ${maximum}.`);
  return chosen;
}
/** Pure planning over the safe SVG writer result; no browser, allocation or encoding. */
export function planPngExport(
  svg: ZlozSvgWriteResult,
  options: ZlozPngExportOptions = {},
): ZlozPngExportPlan {
  const maxDimension = budget(options.maxDimension, 8192, 16384, 'maxDimension'),
    maxPixels = budget(options.maxPixels, 8388608, 16777216, 'maxPixels'),
    maxBytes = budget(options.maxBytes, 8388608, 33554432, 'maxBytes');
  const width = Math.ceil(svg.plan.size.width),
    height = Math.ceil(svg.plan.size.height);
  const findings: ZlozPngFinding[] = [
    ...svg.findings,
    {
      code: 'rasterization-loss',
      severity: 'loss',
      target: { kind: 'document' },
      reason:
        'PNG flattens editable vectors, text and model semantics into browser-rendered pixels. Keep canonical JSON/SVG separately.',
    },
  ];
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > maxDimension ||
    height > maxDimension ||
    !Number.isSafeInteger(width * height) ||
    width * height > maxPixels
  )
    findings.push({
      code: 'png-size-limit',
      severity: 'unsupported',
      target: { kind: 'document' },
      reason: 'PNG output exceeds the configured integer dimension or pixel budget.',
    });
  const base = {
    width,
    height,
    maxBytes,
    findings: Object.freeze(findings.map((f) => Object.freeze({ ...f }))),
  };
  return svg.type === 'written' && !findings.some((f) => f.severity === 'unsupported')
    ? Object.freeze({ ...base, type: 'ready', svg: svg.svg })
    : Object.freeze({ ...base, type: 'blocked' });
}
export type ZlozPngReviewContext = Omit<ZlozSvgReviewContext, 'fileName'> &
  Readonly<{ fileName?: string; png?: ZlozPngExportOptions }>;
export type ZlozPngReviewState = Readonly<{
  svg: ZlozSvgReviewState;
  run: number;
  lossKey: string | null;
  rendering:
    | Readonly<{ type: 'idle' }>
    | Readonly<{ type: 'pending'; key: string; run: number }>
    | Readonly<{ type: 'ready'; key: string; artifact: ZlozPngArtifact }>;
}>;
export type ZlozPngReviewRequest = ZlozSvgReviewIdentity &
  (
    | Readonly<{ type: 'PngSettingsChanged'; preferences: ZlozSvgReviewPreferences }>
    | Readonly<{ type: 'PngLossAcceptanceChanged'; accepted: boolean }>
    | Readonly<{ type: 'PngRenderRequested' | 'PngRenderCancelled' | 'PngDownloadRequested' }>
    | Readonly<{ type: 'PngRenderSettled'; run: number; result: ZlozPngRenderResult }>
  );
export type ZlozPngReviewControls = Readonly<{
  identity: ZlozSvgReviewIdentity;
  svg: ReturnType<typeof resolveSvgReview>;
  plan: ZlozPngExportPlan | null;
  findings: readonly ZlozPngFinding[];
  reason: string | null;
  renderReason: string | null;
  downloadReason: string | null;
  accepted: boolean;
  busy: boolean;
  artifact: ZlozPngArtifact | null;
  fileName: string;
}>;
export type ZlozPngRenderPayload = ZlozSvgReviewIdentity &
  Readonly<{
    run: number;
    input: ZlozPngExportInput;
    plan: Extract<ZlozPngExportPlan, { type: 'ready' }>;
  }>;
export type ZlozPngDownload = Readonly<{ artifact: ZlozPngArtifact; fileName: string }>;
export type ZlozPngReviewUpdate = Readonly<{
  state: ZlozPngReviewState;
  payload: ZlozPngRenderPayload | null;
  download: ZlozPngDownload | null;
  notice: string;
}>;
const svgContext = (context: ZlozPngReviewContext): ZlozSvgReviewContext => ({
  ...context,
  fileName: 'png-preview.svg',
});
export function createPngReview(scope: string): ZlozPngReviewState {
  return { svg: createSvgReview(scope), run: 0, lossKey: null, rendering: { type: 'idle' } };
}
export function pngReviewForScope(state: ZlozPngReviewState, scope: string): ZlozPngReviewState {
  return state.svg.scope === scope
    ? state
    : {
        ...createPngReview(scope),
        svg: createSvgReview(scope, state.svg.preferences),
        run: state.run,
      };
}
/** Exact SVG/source/settings key; current protection is kept separate and rechecked for every action. */
export function resolvePngReview(
  state: ZlozPngReviewState,
  context: ZlozPngReviewContext,
): ZlozPngReviewControls {
  const svg = resolveSvgReview(state.svg, svgContext(context)),
    plan = svg.result ? planPngExport(svg.result, context.png) : null;
  return resolvePngReviewProjection(state, context.fileName, svg, plan);
}
/** @internal Version-neutral PNG presentation from a freshly resolved versioned SVG review. */
export function resolvePngReviewProjection<
  S extends ZlozPngReviewControls['svg'],
  P extends ZlozPngExportPlan,
>(
  state: ZlozPngReviewState,
  fileNameInput: string | undefined,
  svg: S,
  plan: P | null,
): Omit<ZlozPngReviewControls, 'svg' | 'plan'> & Readonly<{ svg: S; plan: P | null }> {
  const identity = {
    scope: state.svg.scope,
    generation: state.svg.generation,
    key: JSON.stringify({ svg: svg.identity.key, plan }),
  };
  const reason =
    svg.reason ?? (plan?.type === 'ready' ? null : 'Resolve PNG export findings before rendering.');
  const accepted = state.lossKey === identity.key,
    busy = state.rendering.type === 'pending' && state.rendering.key === identity.key;
  const artifact =
    state.rendering.type === 'ready' && state.rendering.key === identity.key
      ? state.rendering.artifact
      : null;
  const fileName = fileNameInput ?? 'foldkit-zloz.png';
  if (!/^[^/\\\u0000-\u001f]{1,128}\.png$/iu.test(fileName))
    throw new ZlozError('invalid-edit', 'PNG filename must be a plain .png filename.');
  return {
    identity,
    svg,
    plan,
    findings: plan?.findings ?? svg.findings,
    reason,
    accepted,
    busy,
    artifact,
    fileName,
    renderReason:
      reason ??
      (!accepted
        ? 'Accept the reported PNG losses before rendering.'
        : busy
          ? 'PNG rendering is in progress.'
          : null),
    downloadReason:
      reason ??
      (!accepted
        ? 'Accept the reported PNG losses.'
        : !artifact
          ? 'Render and review the current PNG before downloading.'
          : busy
            ? 'PNG rendering is in progress.'
            : null),
  };
}
/** Pure PNG lifecycle; IO belongs to host Commands using the optional browser entry. */
export function updatePngReview(
  state: ZlozPngReviewState,
  context: ZlozPngReviewContext,
  request: ZlozPngReviewRequest,
): ZlozPngReviewUpdate {
  return updatePngReviewProjection(state, context.scope, request, {
    resolve: () => resolvePngReview(state, context),
    settings: (view, preferences) =>
      updateSvgReview(state.svg, svgContext(context), {
        ...view.svg.identity,
        type: 'SvgSettingsChanged',
        preferences,
      }),
    input: (view, plan) => legacyPngInput(view, plan, context),
  });
}
function legacyPngInput(
  view: ZlozPngReviewControls,
  plan: Extract<ZlozPngExportPlan, { type: 'ready' }>,
  context: ZlozPngReviewContext,
): ZlozPngExportInput {
  if (!view.svg.options)
    throw new ZlozError('invalid-edit', 'Resolve SVG options before creating a PNG job.');
  const layout = view.svg.result?.plan.layout;
  const svg =
    layout === undefined
      ? view.svg.options
      : {
          ...view.svg.options,
          layout: Object.freeze({ snapshot: layout, renderKey: layout.renderKey }),
        };
  return {
    snapshot: parseSnapshot(serializeSnapshot(context.snapshot)),
    svg,
    writing: { ...context.writing, allowLosses: true },
    png: Object.freeze({ ...context.png }),
    expectedSvg: plan.svg,
  };
}
/** @internal Shared lifecycle; native wrappers supply full-document capture, settings and artifact hooks. */
export function updatePngReviewProjection<I, V extends ZlozPngReviewControls>(
  state: ZlozPngReviewState,
  scope: string,
  request: ZlozPngReviewRequest,
  hooks: Readonly<{
    resolve: () => V;
    settings: (
      view: V,
      preferences: ZlozSvgReviewPreferences,
    ) => ReturnType<typeof updateSvgReview>;
    input: (view: V, plan: Extract<ZlozPngExportPlan, { type: 'ready' }>) => I;
    artifactMatches?: (
      artifact: ZlozPngArtifact,
      plan: Extract<ZlozPngExportPlan, { type: 'ready' }>,
    ) => boolean;
  }>,
): Omit<ZlozPngReviewUpdate, 'payload'> &
  Readonly<{
    payload:
      | (ZlozSvgReviewIdentity &
          Readonly<{ run: number; input: I; plan: Extract<ZlozPngExportPlan, { type: 'ready' }> }>)
      | null;
  }> {
  const unchanged = (
    notice = '',
  ): Omit<ZlozPngReviewUpdate, 'payload'> & Readonly<{ payload: null }> => ({
    state,
    payload: null,
    download: null,
    notice,
  });
  if (
    request.scope !== state.svg.scope ||
    scope !== state.svg.scope ||
    request.generation !== state.svg.generation
  )
    return unchanged('This PNG review belongs to another model or generation.');
  const view = hooks.resolve();
  if (request.type === 'PngRenderSettled') {
    if (
      state.rendering.type !== 'pending' ||
      state.rendering.run !== request.run ||
      state.rendering.key !== request.key
    )
      return unchanged();
    const idle = { ...state, rendering: { type: 'idle' as const } };
    if (view.identity.key !== request.key || view.reason !== null || !view.accepted)
      return {
        ...unchanged('PNG source or protection changed. Render the current review.'),
        state: idle,
      };
    if (request.result.type === 'failed')
      return { ...unchanged(`${request.result.code}: ${request.result.reason}`), state: idle };
    const artifact = request.result.artifact,
      plan = view.plan;
    if (
      plan?.type !== 'ready' ||
      artifact.width !== plan.width ||
      artifact.height !== plan.height ||
      !Number.isSafeInteger(artifact.byteLength) ||
      artifact.byteLength < 33 ||
      artifact.byteLength > plan.maxBytes ||
      !artifact.dataUrl.startsWith('data:image/png;base64,iVBORw0KGgo') ||
      artifact.dataUrl.length > Math.ceil(plan.maxBytes / 3) * 4 + 22 ||
      (hooks.artifactMatches !== undefined && !hooks.artifactMatches(artifact, plan))
    )
      return { ...unchanged('PNG output failed its artifact checks.'), state: idle };
    return {
      ...unchanged('PNG rendered. Review the exact image before downloading.'),
      state: {
        ...state,
        rendering: { type: 'ready', key: request.key, artifact: Object.freeze({ ...artifact }) },
      },
    };
  }
  if (request.type === 'PngRenderCancelled')
    return state.rendering.type === 'pending' && state.rendering.key === request.key
      ? {
          ...unchanged('PNG rendering cancelled.'),
          state: { ...state, rendering: { type: 'idle' } },
        }
      : unchanged();
  if (request.key !== view.identity.key)
    return unchanged('PNG source or settings changed; review the current export.');
  if (request.type === 'PngSettingsChanged') {
    const changed = hooks.settings(view, request.preferences);
    return {
      ...unchanged(changed.notice),
      state:
        changed.state === state.svg
          ? state
          : { ...state, svg: changed.state, lossKey: null, rendering: { type: 'idle' } },
    };
  }
  if (request.type === 'PngLossAcceptanceChanged')
    return view.plan?.type === 'ready' && !view.busy
      ? {
          ...unchanged(
            request.accepted
              ? 'PNG losses accepted for this exact export.'
              : 'PNG loss acceptance cleared.',
          ),
          state: { ...state, lossKey: request.accepted ? request.key : null },
        }
      : unchanged(view.reason ?? 'Finish or cancel PNG rendering first.');
  if (request.type === 'PngDownloadRequested')
    return view.downloadReason === null && view.artifact
      ? {
          ...unchanged('Reviewed PNG download requested.'),
          download: { artifact: view.artifact, fileName: view.fileName },
        }
      : unchanged(view.downloadReason ?? 'PNG unavailable.');
  if (view.renderReason !== null || view.plan?.type !== 'ready' || !view.svg.options)
    return unchanged(view.renderReason ?? 'PNG unavailable.');
  if (!Number.isSafeInteger(state.run) || state.run >= Number.MAX_SAFE_INTEGER)
    throw new ZlozError('invalid-edit', 'PNG render counter exhausted.');
  const run = state.run + 1;
  const input = hooks.input(view, view.plan);
  return {
    state: { ...state, run, rendering: { type: 'pending', key: request.key, run } },
    payload: { ...view.identity, run, input, plan: view.plan },
    download: null,
    notice: 'Rendering the reviewed PNG.',
  };
}
