import {
  captureGroupDocumentV3,
  serializeGroupDocumentV3,
  type ZlozGroupDocumentV3,
} from './group-document-v3';
import {
  writeGroupSvgExportV3,
  type ZlozGroupSvgExportOptionsV3,
  type ZlozGroupSvgWriteOptionsV3,
  type ZlozGroupSvgLayoutOptionsV3,
  type ZlozGroupSvgWriteResultV3,
} from './group-svg-v3';
import type { ZlozSvgExportOptions } from './svg-export';
import {
  resolveSvgReviewProjection,
  updateSvgReviewProjection,
  type ZlozSvgReviewContext,
  type ZlozSvgReviewState,
  type ZlozSvgReviewControls,
  type ZlozSvgReviewRequest,
  type ZlozSvgReviewUpdate,
} from './svg-review';

export type ZlozGroupSvgReviewContextV3 = Omit<
  ZlozSvgReviewContext,
  'snapshot' | 'layout' | 'writing' | 'canDownload'
> &
  Readonly<{
    document: ZlozGroupDocumentV3;
    layout?: ZlozGroupSvgLayoutOptionsV3;
    writing?: Omit<ZlozGroupSvgWriteOptionsV3, 'allowLosses'>;
    canDownload?: (
      document: ZlozGroupDocumentV3,
      options: ZlozGroupSvgExportOptionsV3 | null,
    ) => string | null;
  }>;
/** Shared SVG view primitives accept these controls; the source/result retain their native v3 types. */
export type ZlozGroupSvgReviewControlsV3 = Omit<ZlozSvgReviewControls, 'options' | 'result'> &
  Readonly<{
    options: ZlozGroupSvgExportOptionsV3 | null;
    result: ZlozGroupSvgWriteResultV3 | null;
  }>;
function nativeOptions(
  options: ZlozSvgExportOptions,
  layout: ZlozGroupSvgLayoutOptionsV3 | undefined,
): ZlozGroupSvgExportOptionsV3 {
  const { layout: _legacy, ...base } = options;
  return layout === undefined ? base : { ...base, layout };
}
/** Reuses review state/UI, with full-document identity and distinct native validation/writing. No downgrade or graph edits. */
export function resolveGroupSvgReviewV3(
  state: ZlozSvgReviewState,
  context: ZlozGroupSvgReviewContextV3,
): ZlozGroupSvgReviewControlsV3 {
  const document = captureGroupDocumentV3(context.document);
  const { document: _source, writing, canDownload, ...base } = context;
  const shared: ZlozSvgReviewContext = {
    ...base,
    snapshot: document,
    canDownload: (_snapshot, options) =>
      canDownload?.(document, options ? nativeOptions(options, context.layout) : null) ?? null,
  };
  const controls = resolveSvgReviewProjection(
    state,
    shared,
    (options) =>
      writeGroupSvgExportV3(document, nativeOptions(options, context.layout), {
        ...writing,
        allowLosses: true,
      }),
    () => serializeGroupDocumentV3(document),
  );
  return {
    ...controls,
    options: controls.options ? nativeOptions(controls.options, context.layout) : null,
  };
}
/** Produces a detached download only after current native source, fidelity consent and host-policy checks. */
export function updateGroupSvgReviewV3(
  state: ZlozSvgReviewState,
  context: ZlozGroupSvgReviewContextV3,
  request: ZlozSvgReviewRequest,
): ZlozSvgReviewUpdate {
  return updateSvgReviewProjection(state, context.scope, request, () =>
    resolveGroupSvgReviewV3(state, context),
  );
}
