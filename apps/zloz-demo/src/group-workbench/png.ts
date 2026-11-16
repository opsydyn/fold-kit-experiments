import {
  resolveGroupPngReviewV3,
  pngReviewForScope,
  type ZlozGroupPngReviewContextV3,
} from '@opsydyn/foldkit-zloz';

import type { ReadyState } from './main';
import { groupSvgContext } from './svg';
export function groupPngContext(state: ReadyState): ZlozGroupPngReviewContextV3 {
  return { ...groupSvgContext(state, 'png'), fileName: 'zloz-native-v3.png' };
}
export function groupPngControls(state: ReadyState) {
  const context = groupPngContext(state);
  return resolveGroupPngReviewV3(pngReviewForScope(state.pngReview, context.scope), context);
}
