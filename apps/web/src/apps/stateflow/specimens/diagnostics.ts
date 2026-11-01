/**
 * The request-diagnostics explorer's Machine: loading metrics, brushing a selection,
 * filtering, reloading and leaving the page, with the cancellations between. Its app on
 * `/request-diagnostics` reports each message live.
 */
import { Command } from 'foldkit';

import { diagnosticsMachine } from '../../request-diagnostics/machine';
import { Message } from '../../request-diagnostics/message';
import { samplePoints } from '../../request-diagnostics/model';
import { defineSpecimen } from '../specimen';

/** The messages the coverage search combines, named as a test would name them. */
export const diagnosticsExamples = {
  loaded: Message.LoadedMetrics({ points: samplePoints }),
  failed: Message.FailedLoad({ error: 'Metrics service unavailable' }),
  startedSelection: Message.StartedSelection(),
  wideSelection: Message.ChangedSelection({ domain: [45, 350] }),
  narrowSelection: Message.ChangedSelection({ domain: [45, 46] }),
  clearedSelection: Message.ClearedSelection(),
  reload: Message.ClickedReload(),
  leftPage: Message.Navigated({
    phase: 'exited',
    path: '/request-diagnostics',
    previousPath: '/',
  }),
  cancelled: Message.CompletedCancelFetchMetrics({
    outcome: Command.Interruptible.Outcome.Interrupted(),
  }),
} as const;

export const diagnosticsSpecimen = defineSpecimen({
  id: 'request-diagnostics',
  label: 'Request diagnostics',
  summary: 'Loads metrics, brushes and filters them, and cancels the load on reload or exit.',
  livePath: '/request-diagnostics',
  machineName: 'diagnosticsMachine',
  examplesName: 'diagnosticsExamples',
  machine: diagnosticsMachine,
  message: Message,
  errorStates: ['Failed'],
  transientStates: ['Loading', 'Cancelling'],
  examples: diagnosticsExamples,
  sample: [
    Message.LoadedMetrics({ points: samplePoints }),
    Message.StartedSelection(),
    Message.ChangedSelection({ domain: [45, 350] }),
    Message.ClearedSelection(),
    Message.ClickedReload(),
    Message.CompletedCancelFetchMetrics({ outcome: Command.Interruptible.Outcome.NotFound() }),
    Message.Navigated({ phase: 'exited', path: '/request-diagnostics', previousPath: '/' }),
    Message.CompletedCancelFetchMetrics({ outcome: Command.Interruptible.Outcome.NotFound() }),
  ],
});
