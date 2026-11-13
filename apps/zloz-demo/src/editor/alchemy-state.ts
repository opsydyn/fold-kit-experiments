import type { EditorState } from '@opsydyn/foldkit-zloz';
import type { AlchemyProjection } from '@opsydyn/foldkit-zloz-alchemy';
export type AlchemyReviewState = Readonly<{
  text: string;
  run: number;
  pending: Readonly<{ run: number; modelId: string; epoch: number }> | null;
  review: Readonly<{
    id: number;
    projection: Extract<AlchemyProjection, { type: 'reviewable' }>;
    editor: EditorState;
  }> | null;
  notice: string;
}>;
export function createAlchemyReview(): AlchemyReviewState {
  return { text: '', run: 0, pending: null, review: null, notice: '' };
}
