import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type * as Histogram from '../../ui/histogram-chart';
import type * as Scatter from '../../ui/scatter-chart';

export const Message = defineMessageUnion({
  CompletedFocusComparisonTarget: {},
  CompletedRestoreComparisonFocus: {},
  ClickedAddPanel: { kind: Schema.Literals(['scatter', 'histogram']) },
  ClickedRemovePanel: { id: Schema.Number },
  ClickedMovePanel: { id: Schema.Number, direction: Schema.Literals(['earlier', 'later']) },
  ChangedLinkInspections: { enabled: Schema.Boolean },
  // Typed child payloads use the repository's Schema.Unknown override contract below.
  // oxlint-disable-next-line foldkit/got-prefix-requires-submodel-payload
  GotScatterMessage: { id: Schema.Number, message: Schema.Unknown },
  // oxlint-disable-next-line foldkit/got-prefix-requires-submodel-payload
  GotHistogramMessage: { id: Schema.Number, message: Schema.Unknown },
});
export type GotScatterMessage = Omit<typeof Message.GotScatterMessage.Type, 'message'> & {
  readonly message: Scatter.Message;
};
export type GotHistogramMessage = Omit<typeof Message.GotHistogramMessage.Type, 'message'> & {
  readonly message: Histogram.Message;
};
export type Message = typeof Message.Type;
