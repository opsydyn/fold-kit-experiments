import { Effect } from 'effect';
import { Command, Port } from 'foldkit';

import { Message } from './message';
import { TransitionRecorded, TransitionTelemetryPort } from './ports';

export const ReportTransition = Command.define('ReportTransition', {
  args: { record: TransitionRecorded },
  messages: [Message.CompletedReportTransition],
  execute: ({ record }) =>
    Port.emit(TransitionTelemetryPort, record).pipe(
      Effect.map(() => Message.CompletedReportTransition({ sequence: record.sequence })),
    ),
});
