import { describe, expect, test } from 'vitest';

import {
  ChangedSelection,
  ClearedSelection,
  ClickedReload,
  CompletedCancelFetchMetrics,
  LoadedMetrics,
} from './message';
import { initModel, samplePoints } from './model';
import { diagnosticsMachine, update } from './update';

describe('request diagnostics machine', () => {
  test('loads data from the loading state', () => {
    const result = diagnosticsMachine.step(
      { _tag: 'Loading' },
      LoadedMetrics({ points: samplePoints }),
    );

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Ready',
      state: { _tag: 'Ready', points: samplePoints },
    });
  });

  test('accepts a non-empty selection and exposes its guard value', () => {
    const result = diagnosticsMachine.step(
      { _tag: 'Ready', points: samplePoints },
      ChangedSelection({ domain: [100, 300] }),
    );

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Filtered',
      state: { _tag: 'Filtered', domain: [100, 300], allPoints: samplePoints },
    });
  });

  test('interrupts an in-flight metrics request before reloading', () => {
    const result = diagnosticsMachine.step({ _tag: 'Loading' }, ClickedReload());

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Cancelling',
      state: { _tag: 'Cancelling' },
      commands: [{ name: 'FetchMetrics.Interrupt', interruptsKey: 'FetchMetrics' }],
    });
  });

  test('starts the replacement request from the interrupt outcome', () => {
    const [model, commands] = update(
      { ...initModel, explorer: { _tag: 'Cancelling' } },
      CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
    );

    expect(model.explorer).toEqual({ _tag: 'Loading' });
    expect(commands).toMatchObject([{ name: 'FetchMetrics', key: 'FetchMetrics' }]);
  });

  test('restores all points when a filtered selection is cleared', () => {
    const result = diagnosticsMachine.step(
      {
        _tag: 'Filtered',
        points: samplePoints.slice(0, 2),
        allPoints: samplePoints,
        domain: [100, 300],
      },
      ClearedSelection(),
    );

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Ready',
      state: { _tag: 'Ready', points: samplePoints },
    });
  });
});
