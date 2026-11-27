import { c4MappingReviewPanel } from './c4-mapping-review-view';
import { mappingReviewPanel } from './mapping-review-view';
import { Message } from './message';
import type { Model } from './model';
import { architectureNativePanel } from './native-panel';

const receiptEvents = [
  Message.cases.ChoseConversionReceiptFiles,
  Message.cases.ClickedCancelReceiptRead,
  Message.cases.ClickedCloseReceiptReview,
  Message.cases.ClickedReceiptChange,
  Message.cases.ClickedReceiptChangeStep,
  Message.cases.ClickedReceiptOverview,
  Message.cases.SelectedReceiptSide,
] as const;

export const nativeMappingReview = architectureNativePanel<Model>((h, model, send) =>
  mappingReviewPanel(model, h, send),
);

export const nativeC4MappingReview = architectureNativePanel<Model>((h, model, send) =>
  c4MappingReviewPanel(model, h, send),
);
