import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  SelectedCohort: { key: Schema.String },
  ClickedPage: { delta: Schema.Literals([-1, 1]) },
  ClickedRemovedPage: { delta: Schema.Literals([-1, 1]) },
  ClickedRelationship: { id: Schema.String },
  ClickedReview: { id: Schema.String },
  RecordedWidth: { width: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  SelectedRelationship: { id: Schema.String },
  RequestedAssessmentReview: { id: Schema.String },
});
export type OutMessage = typeof OutMessage.Type;
