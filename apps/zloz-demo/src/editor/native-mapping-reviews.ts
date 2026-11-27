import { Schema } from 'effect';

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

export const nativeMappingReview = architectureNativePanel<Model>(
  'ArchitectureMappingReview',
  Schema.is(
    Schema.Union([
      ...receiptEvents,
      Message.cases.ClickedApplyMappingConversion,
      Message.cases.ClickedDownloadConversionReceipt,
      Message.cases.ClickedMappingApplyProtection,
      Message.cases.ClickedMappingLossAcknowledgement,
      Message.cases.ClickedResetMappingReview,
      Message.cases.SelectedExample,
      Message.cases.SelectedMappingReviewChoice,
      Message.cases.SelectedMappingReviewItem,
    ]),
  ),
  (h, model, send) => mappingReviewPanel(model, h, send),
);

export const nativeC4MappingReview = architectureNativePanel<Model>(
  'ArchitectureC4MappingReview',
  Schema.is(
    Schema.Union([
      ...receiptEvents,
      Message.cases.ChangedC4PlacementForm,
      Message.cases.ChangedC4ReviewForm,
      Message.cases.ClickedC4ApplyProtection,
      Message.cases.ClickedC4ConversionApply,
      Message.cases.ClickedC4PlacementClear,
      Message.cases.ClickedC4PlacementReview,
      Message.cases.ClickedC4PlanAcknowledgement,
      Message.cases.ClickedC4ReceiptDownload,
      Message.cases.ClickedC4ReviewAction,
      Message.cases.SelectedC4PlacementMember,
      Message.cases.SelectedC4ReviewItem,
    ]),
  ),
  (h, model, send) => c4MappingReviewPanel(model, h, send),
);
