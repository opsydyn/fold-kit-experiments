import { Command } from 'foldkit';

import { Message as DiagnosticsMessage } from '../request-diagnostics/message';
import { samplePoints } from '../request-diagnostics/model';
import type { ReplayEvent } from './ports';

export const fixture: ReadonlyArray<ReplayEvent> = [
  DiagnosticsMessage.LoadedMetrics({ points: samplePoints }),
  DiagnosticsMessage.StartedSelection(),
  DiagnosticsMessage.ChangedSelection({ domain: [45, 350] }),
  DiagnosticsMessage.ClearedSelection(),
  DiagnosticsMessage.ClickedReload(),
  DiagnosticsMessage.CompletedCancelFetchMetrics({
    outcome: Command.Interruptible.Outcome.NotFound(),
  }),
  DiagnosticsMessage.Navigated({
    phase: 'exited',
    path: '/request-diagnostics',
    previousPath: '/',
  }),
  DiagnosticsMessage.CompletedCancelFetchMetrics({
    outcome: Command.Interruptible.Outcome.NotFound(),
  }),
];
