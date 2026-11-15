import {
  resolvePngReview,
  updatePngReview,
  pngReviewForScope,
  type ZlozPngReviewContext,
  type ZlozPngReviewRequest,
} from '@opsydyn/foldkit-zloz';
import type { Return } from 'foldkit/update';

import { RenderPng, DownloadPng } from './command';
import type { Message } from './message';
import type { Model } from './model';
import { workbenchSvgContext } from './svg-review';
function context(model: Model): ZlozPngReviewContext {
  return { ...workbenchSvgContext(model, 'png'), fileName: 'zloz-workbench.png' };
}
export function workbenchPngReview(model: Model) {
  const ctx = context(model);
  return resolvePngReview(pngReviewForScope(model.pngReview, ctx.scope), ctx);
}
export function updateWorkbenchPngReview(
  model: Model,
  request: ZlozPngReviewRequest,
): Return<Model, Message> {
  const ctx = context(model),
    result = updatePngReview(pngReviewForScope(model.pngReview, ctx.scope), ctx, request);
  const next = { ...model, pngReview: result.state, notice: result.notice || model.notice };
  return result.payload
    ? { model: next, commands: [RenderPng({ payload: result.payload })] }
    : result.download
      ? { model: next, commands: [DownloadPng(result.download)] }
      : { model: next };
}
