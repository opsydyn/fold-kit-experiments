import { EventSchemas } from '@ag-ui/core/schemas';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Filter, NavigationValue, Scenario } from './contract';

export const Message = defineMessageUnion({
  ClickedRun: {},
  ClickedCancel: {},
  ClickedRecover: {},
  SelectedScenario: { scenario: Scenario },
  ClickedFilter: { filter: Filter },
  ClickedService: { id: Schema.String },
  ChangedCompactView: { isCompact: Schema.Boolean },
  ReceivedAgentEvent: { runId: Schema.String, event: Schema.Unknown },
  FailedStream: { runId: Schema.String, error: Schema.String },
  Navigated: NavigationValue.fields,
});
export type Message = typeof Message.Type;

// The transport payload stays unknown until the SDK validates this Message boundary.
export const decodeAgentEvent = (message: typeof Message.ReceivedAgentEvent.Type) =>
  EventSchemas.safeParse(message.event);
