import { Command } from '@effect/ui';
import {
  resolvePngReview,
  updatePngReview,
  pngReviewForScope,
  type ZlozPngReviewContext,
  type ZlozPngReviewRequest,
} from '@opsydyn/foldkit-zloz';

import { RenderPng, DownloadPng } from './command';
import type { Message } from './message';
import type { Model } from './model';
import { workbenchSvgContext } from './svg-review';
import type { Return } from './transition';
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
  const ctx = context(model);
  const review = pngReviewForScope(model.pngReview, ctx.scope);
  const result = updatePngReview(review, ctx, request);
  const next = { ...model, pngReview: result.state, notice: result.notice || model.notice };
  if (
    request.type === 'PngRenderCancelled' &&
    review.rendering.type === 'pending' &&
    result.state.rendering.type === 'idle'
  )
    return {
      model: next,
      interrupts: [Command.interrupt(RenderPng, { scope: ctx.scope, run: review.rendering.run })],
    };
  return result.payload
    ? {
        model: next,
        commands: [
          RenderPng.make({
            scope: result.payload.scope,
            run: result.payload.run,
            payload: result.payload,
          }),
        ],
      }
    : result.download
      ? { model: next, commands: [DownloadPng.make(result.download)] }
      : { model: next };
}
