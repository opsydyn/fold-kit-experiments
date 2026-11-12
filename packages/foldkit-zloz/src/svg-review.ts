import { serializeGraph, serializeSnapshot, ZlozError } from './graph';
import type { ZlozSvgExportOptions, ZlozSvgBounds } from './svg-export';
import {
  writeSvgExport,
  type ZlozSvgWriteOptions,
  type ZlozSvgWriteResult,
  type ZlozSvgWriteFinding,
} from './svg-writer';
import type { ZlozSnapshot, Size } from './types';

export type ZlozSvgReviewPreferences = Readonly<{
  regionId: string;
  themeId: string;
  backgroundId: string;
  scale: number;
}>;
export type ZlozSvgReviewState = Readonly<{
  scope: string;
  generation: number;
  preferences: ZlozSvgReviewPreferences;
  lossKey: string | null;
  run: number;
  download: Readonly<{ type: 'idle' }> | Readonly<{ type: 'pending'; key: string; run: number }>;
}>;
export type ZlozSvgReviewChoice<T> = Readonly<{ id: string; label: string; value: T }>;
export type ZlozSvgReviewRegion =
  | Readonly<{ type: 'model'; padding: number }>
  | Readonly<{ type: 'viewport' }>
  | Readonly<{ type: 'bounds'; bounds: ZlozSvgBounds }>;
export type ZlozSvgReviewContext = Readonly<{
  scope: string;
  sourceRevision: number | string;
  snapshot: ZlozSnapshot;
  surface?: Size | null;
  title: string;
  description?: string;
  fileName?: string;
  theme: ZlozSvgExportOptions['theme'];
  font?: ZlozSvgExportOptions['font'];
  renderers: ZlozSvgExportOptions['renderers'];
  assets?: ZlozSvgExportOptions['assets'];
  writing?: Omit<ZlozSvgWriteOptions, 'allowLosses'>;
  regions?: readonly ZlozSvgReviewChoice<ZlozSvgReviewRegion>[];
  themes?: readonly ZlozSvgReviewChoice<ZlozSvgExportOptions['theme']>[];
  backgrounds?: readonly ZlozSvgReviewChoice<ZlozSvgExportOptions['background']>[];
  canDownload?: (snapshot: ZlozSnapshot, options: ZlozSvgExportOptions | null) => string | null;
}>;
export type ZlozSvgReviewIdentity = Readonly<{ scope: string; generation: number; key: string }>;
export type ZlozSvgReviewRequest = ZlozSvgReviewIdentity &
  (
    | Readonly<{ type: 'SvgSettingsChanged'; preferences: ZlozSvgReviewPreferences }>
    | Readonly<{ type: 'SvgLossAcceptanceChanged'; accepted: boolean }>
    | Readonly<{ type: 'SvgDownloadRequested' }>
    | Readonly<{ type: 'SvgDownloadSettled'; run: number; outcome: 'succeeded' | 'failed' }>
  );
export type ZlozSvgDownload = ZlozSvgReviewIdentity &
  Readonly<{ run: number; fileName: string; svg: string }>;
export type ZlozSvgReviewControls = Readonly<{
  identity: ZlozSvgReviewIdentity;
  preferences: ZlozSvgReviewPreferences;
  regions: readonly ZlozSvgReviewChoice<ZlozSvgReviewRegion>[];
  themes: readonly ZlozSvgReviewChoice<ZlozSvgExportOptions['theme']>[];
  backgrounds: readonly ZlozSvgReviewChoice<ZlozSvgExportOptions['background']>[];
  result: ZlozSvgWriteResult | null;
  findings: readonly ZlozSvgWriteFinding[];
  reason: string | null;
  downloadReason: string | null;
  hasLosses: boolean;
  accepted: boolean;
  busy: boolean;
  fileName: string;
}>;
export type ZlozSvgReviewUpdate = Readonly<{
  state: ZlozSvgReviewState;
  payload: ZlozSvgDownload | null;
  notice: string;
}>;
function invalid(reason: string): never {
  throw new ZlozError('invalid-edit', reason);
}
function isRevision(value: unknown): value is string | number {
  return typeof value === 'number'
    ? Number.isSafeInteger(value) && value >= 0
    : typeof value === 'string' && value.trim().length > 0;
}
function nonblank(value: string) {
  if (!value.trim()) invalid('SVG review identifiers must be non-blank.');
  return value;
}
function next(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER)
    invalid('SVG review counter is exhausted.');
  return value + 1;
}
function preferenceReason(p: ZlozSvgReviewPreferences): string | null {
  if (!p.regionId.trim() || !p.themeId.trim() || !p.backgroundId.trim())
    return 'Choose an export region, theme and background.';
  return Number.isFinite(p.scale) && p.scale > 0 ? null : 'Choose a positive finite export scale.';
}
export function createSvgReview(
  scope: string,
  preferences: Partial<ZlozSvgReviewPreferences> = {},
): ZlozSvgReviewState {
  nonblank(scope);
  const selected = {
    regionId: 'model',
    themeId: 'source',
    backgroundId: 'theme',
    scale: 1,
    ...preferences,
  };
  const reason = preferenceReason(selected);
  if (reason) invalid(reason);
  return {
    scope,
    generation: 0,
    preferences: selected,
    lossKey: null,
    run: 0,
    download: { type: 'idle' },
  };
}
/** New model/controller incarnations invalidate consent and pending callbacks, retaining preferences. */
export function svgReviewForScope(state: ZlozSvgReviewState, scope: string): ZlozSvgReviewState {
  return state.scope === scope ? state : createSvgReview(scope, state.preferences);
}
function choices<T>(values: readonly ZlozSvgReviewChoice<T>[]): readonly ZlozSvgReviewChoice<T>[] {
  const ids = new Set<string>();
  for (const value of values) {
    nonblank(value.id);
    nonblank(value.label);
    if (ids.has(value.id)) invalid('SVG review choices need unique IDs.');
    ids.add(value.id);
  }
  return values;
}
/** Pure projection of the exact candidate artifact. Findings remain visible even when download is protected. */
export function resolveSvgReview(
  state: ZlozSvgReviewState,
  context: ZlozSvgReviewContext,
): ZlozSvgReviewControls {
  if (!isRevision(context.sourceRevision))
    invalid('SVG review requires a source revision or immutable snapshot identity.');
  const regions = choices(
    context.regions ?? [
      { id: 'model', label: 'Whole model', value: { type: 'model', padding: 24 } },
      { id: 'viewport', label: 'Viewport crop', value: { type: 'viewport' } },
    ],
  );
  const themes = choices(
    context.themes ?? [
      { id: 'source', label: 'Source theme', value: context.theme },
      { id: 'light', label: 'Light', value: { colorScheme: 'light' } },
      { id: 'dark', label: 'Dark', value: { colorScheme: 'dark' } },
    ],
  );
  const backgrounds = choices(
    context.backgrounds ?? [
      { id: 'theme', label: 'Theme background', value: { type: 'theme' } },
      { id: 'transparent', label: 'Transparent', value: { type: 'transparent' } },
    ],
  );
  const p = state.preferences,
    region = regions.find((c) => c.id === p.regionId)?.value,
    theme = themes.find((c) => c.id === p.themeId)?.value,
    background = backgrounds.find((c) => c.id === p.backgroundId)?.value;
  const fileName = context.fileName ?? 'foldkit-zloz.svg';
  if (!/^[^/\\\u0000-\u001f]{1,128}\.svg$/iu.test(fileName))
    invalid('SVG filename must be a plain .svg filename.');
  let reason =
    state.scope === context.scope ? null : 'This SVG review belongs to another model session.';
  if (!region || !theme || !background)
    reason = reason ?? 'The chosen export setting is no longer available.';
  let options: ZlozSvgExportOptions | null = null;
  if (region && theme && background) {
    let outputRegion: ZlozSvgExportOptions['region'] | null = null;
    if (region.type === 'viewport') {
      if (
        !context.surface ||
        !Number.isFinite(context.surface.width) ||
        !Number.isFinite(context.surface.height) ||
        context.surface.width <= 0 ||
        context.surface.height <= 0 ||
        !context.snapshot.viewport
      )
        reason = reason ?? 'Measure the canvas and camera before exporting its viewport.';
      else
        outputRegion = {
          type: 'viewport',
          size: { width: context.surface.width, height: context.surface.height },
        };
    } else outputRegion = region;
    if (outputRegion) {
      const base = {
        title: context.title,
        region: outputRegion,
        scale: p.scale,
        theme,
        background,
        font: context.font ?? { family: 'sans-serif', size: 14, weight: 400 },
        renderers: context.renderers,
      };
      const described =
        context.description === undefined ? base : { ...base, description: context.description };
      options = context.assets === undefined ? described : { ...described, assets: context.assets };
    }
  }
  const result = options
    ? writeSvgExport(context.snapshot, options, { ...context.writing, allowLosses: true })
    : null;
  const artifactReason =
    reason ??
    (result?.type === 'blocked' ? 'Resolve unsupported SVG findings before downloading.' : null);
  const policy = context.canDownload?.(context.snapshot, options) ?? null;
  if (policy !== null) reason = reason ?? (policy.trim() || 'SVG downloads are protected.');
  if (result?.type === 'blocked')
    reason = reason ?? 'Resolve unsupported SVG findings before downloading.';
  const source =
    region?.type === 'viewport'
      ? serializeSnapshot(context.snapshot)
      : serializeGraph(context.snapshot.graph);
  const findings = result?.findings ?? [];
  const key = JSON.stringify({
    scope: context.scope,
    generation: state.generation,
    sourceRevision: context.sourceRevision,
    source,
    options,
    reason: artifactReason,
    fileName,
    result: result?.type ?? 'unavailable',
    svg: result?.type === 'written' ? result.svg : null,
    findings,
  });
  const identity = { scope: state.scope, generation: state.generation, key };
  const hasLosses = findings.some((f) => f.severity === 'loss'),
    accepted = hasLosses && state.lossKey === key;
  const busy = state.download.type === 'pending' && state.download.key === key;
  const downloadReason =
    reason ??
    (hasLosses && !accepted ? 'Accept the reported SVG losses before downloading.' : null) ??
    (busy ? 'SVG download is in progress.' : null);
  return {
    identity,
    preferences: p,
    regions,
    themes,
    backgrounds,
    result,
    findings,
    reason,
    downloadReason,
    hasLosses,
    accepted,
    busy,
    fileName,
  };
}
/** Produces a detached file payload only after live checks; browser/CLI IO belongs to the host. */
export function updateSvgReview(
  state: ZlozSvgReviewState,
  context: ZlozSvgReviewContext,
  request: ZlozSvgReviewRequest,
): ZlozSvgReviewUpdate {
  const unchanged = (notice = ''): ZlozSvgReviewUpdate => ({ state, payload: null, notice });
  if (
    request.scope !== state.scope ||
    context.scope !== state.scope ||
    request.generation !== state.generation
  )
    return unchanged('This SVG review changed; review the current export.');
  const controls = resolveSvgReview(state, context);
  if (request.type === 'SvgDownloadSettled') {
    if (
      state.download.type !== 'pending' ||
      state.download.run !== request.run ||
      state.download.key !== request.key
    )
      return unchanged();
    return {
      state: { ...state, download: { type: 'idle' } },
      payload: null,
      notice:
        controls.identity.key !== request.key
          ? ''
          : request.outcome === 'succeeded'
            ? 'SVG download handed off.'
            : 'SVG download failed. Your model is unchanged.',
    };
  }
  if (request.key !== controls.identity.key)
    return unchanged('This SVG review changed; review the current export.');
  if (request.type === 'SvgSettingsChanged') {
    const reason = preferenceReason(request.preferences);
    if (reason) return unchanged(reason);
    return {
      state: {
        ...state,
        generation: next(state.generation),
        preferences: {
          regionId: request.preferences.regionId,
          themeId: request.preferences.themeId,
          backgroundId: request.preferences.backgroundId,
          scale: request.preferences.scale,
        },
        lossKey: null,
        download: { type: 'idle' },
      },
      payload: null,
      notice: 'SVG settings changed. Review the updated findings.',
    };
  }
  if (request.type === 'SvgLossAcceptanceChanged') {
    if (controls.result?.type !== 'written' || !controls.hasLosses || controls.busy)
      return unchanged(controls.reason ?? 'No SVG losses require acceptance.');
    return {
      state: { ...state, lossKey: request.accepted === true ? controls.identity.key : null },
      payload: null,
      notice: request.accepted
        ? 'Reported SVG losses accepted for this export.'
        : 'SVG loss acceptance cleared.',
    };
  }
  if (controls.downloadReason !== null || controls.result?.type !== 'written')
    return unchanged(controls.downloadReason ?? 'SVG is unavailable.');
  const run = next(state.run);
  return {
    state: { ...state, run, download: { type: 'pending', key: controls.identity.key, run } },
    payload: { ...controls.identity, run, fileName: controls.fileName, svg: controls.result.svg },
    notice: 'Preparing the reviewed SVG download.',
  };
}
