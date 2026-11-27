import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  SelectedCohort: { key: Schema.String },
  ClickedPage: { delta: Schema.Literals([-1, 1]) },
  ClickedRemovedPage: { delta: Schema.Literals([-1, 1]) },
  ClickedRelationship: { id: Schema.String },
  ClickedReview: { id: Schema.String },
  RecordedWidth: { width: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum({
  SelectedRelationship: { id: Schema.String },
  RequestedAssessmentReview: { id: Schema.String },
});
export type OutMessage = typeof OutMessage.Type;
