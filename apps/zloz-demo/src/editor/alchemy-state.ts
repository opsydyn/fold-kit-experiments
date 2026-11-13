import type { EditorState, LayoutRequest, ZlozLabelMeasurements } from '@opsydyn/foldkit-zloz';
import type { AlchemyProjection } from '@opsydyn/foldkit-zloz-alchemy';
export type AlchemyReviewState = Readonly<{
  text: string;
  run: number;
  pending: Readonly<{ run: number; modelId: string; epoch: number }> | null;
  review: Readonly<{
    id: number;
    projection: Extract<AlchemyProjection, { type: 'reviewable' }>;
    editor: EditorState;
    layout: Readonly<{
      run: number;
      direction: 'RIGHT' | 'DOWN';
      displayed: 'original' | 'elk';
      pending: LayoutRequest | null;
      labels: Readonly<{
        mode: 'declared' | 'measured';
        detail: 'compact' | 'expanded';
        run: number;
        measurement: ZlozLabelMeasurements;
      }>;
    }>;
  }> | null;
  notice: string;
}>;
export function createAlchemyReview(): AlchemyReviewState {
  return { text: '', run: 0, pending: null, review: null, notice: '' };
}
