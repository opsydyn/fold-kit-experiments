import { describe, expect, test } from 'vitest';

import {
  ChangedSelection,
  ClearedSelection,
  ClickedReload,
  CompletedCancelFetchMetrics,
  LoadedMetrics,
  Navigated,
} from './message';
import { Idle, initModel, samplePoints } from './model';
import { diagnosticsMachine, update } from './update';

const exited = Navigated({
  phase: 'exited',
  path: '/request-diagnostics',
  previousPath: '/',
});

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
      state: { _tag: 'Cancelling', reason: 'Reload' },
      commands: [{ name: 'FetchMetrics.Interrupt', interruptsKey: 'FetchMetrics' }],
    });
  });

  test('interrupts active metrics work when the Astro island exits', () => {
    const result = diagnosticsMachine.step({ _tag: 'Loading' }, exited);

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Cancelling',
      state: { _tag: 'Cancelling', reason: 'RouteExit' },
      commands: [{ name: 'FetchMetrics.Interrupt', interruptsKey: 'FetchMetrics' }],
    });
  });

  test('starts the replacement request from the interrupt outcome', () => {
    const [model, commands] = update(
      { ...initModel, explorer: { _tag: 'Cancelling', reason: 'Reload' } },
      CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
    );

    expect(model.explorer).toEqual({ _tag: 'Loading' });
    expect(commands).toMatchObject([{ name: 'FetchMetrics', key: 'FetchMetrics' }]);
  });

  test('does not replace metrics work after route-exit cancellation', () => {
    const [model, commands] = update(
      { ...initModel, explorer: { _tag: 'Cancelling', reason: 'RouteExit' } },
      CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
    );

    expect(model.explorer).toEqual({ _tag: 'Idle' });
    expect(commands).toEqual([]);
  });

  test('does not interrupt completed metrics work on route exit', () => {
    const [model, commands] = update(
      { ...initModel, explorer: { _tag: 'Ready', points: samplePoints } },
      exited,
    );

    expect(model.explorer).toEqual({ _tag: 'Ready', points: samplePoints });
    expect(commands).toEqual([]);
  });

  test('ignores a late successful load after route-exit cancellation', () => {
    const model = { ...initModel, explorer: Idle() };
    const [nextModel, commands] = update(model, LoadedMetrics({ points: samplePoints }));

    expect(nextModel.explorer).toBe(model.explorer);
    expect(nextModel.histogram).toBe(model.histogram);
    expect(nextModel.scatter).toBe(model.scatter);
    expect(nextModel.lastTransition).toBe('LoadedMetrics ignored in Idle');
    expect(commands).toEqual([]);
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
