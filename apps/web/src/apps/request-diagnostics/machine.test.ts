import { describe, expect, test } from 'vitest';

import { ChangedSelection, ClearedSelection, ClickedReload, LoadedMetrics } from './message';
import { samplePoints } from './model';
import { diagnosticsMachine } from './update';

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

  test('ignores a reload message while loading', () => {
    const result = diagnosticsMachine.step({ _tag: 'Loading' }, ClickedReload());

    expect(result).toEqual({
      _tag: 'Ignored',
      stateTag: 'Loading',
      messageTag: 'ClickedReload',
      state: { _tag: 'Loading' },
    });
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
