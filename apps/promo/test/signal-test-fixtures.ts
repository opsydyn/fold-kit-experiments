import type { Sample } from '../src/examples/signals/data';
import { init as initQuality } from '../src/examples/signals/model';
import { observedRecords } from '../src/examples/signals/quality';
import { qualityProps } from '../src/examples/signals/quality-data';
export const init = ({ data }: { readonly data: ReadonlyArray<Sample> }) =>
  initQuality({
    data: observedRecords(data),
    snapshot: qualityProps.snapshot,
    maxGapMs: qualityProps.maxGapMs,
    scenarioAsOf: qualityProps.scenarioAsOf,
    thresholds: [],
  });
