import { rowsOf } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, test } from 'vitest';

import { diagnosticsMachine } from './machine';
import { Message } from './message';
import { ExplorerState, initModel, samplePoints } from './model';
import { update } from './update';

/** The machine's own Commands: every message it takes is also reported to the observatory. */
const machineCommands = (commands: ReadonlyArray<{ readonly name: string }> | undefined) =>
  (commands ?? []).filter(({ name }) => name !== 'ReportToObservatory');

const exited = Message.Navigated({
  phase: 'exited',
  path: '/request-diagnostics',
  previousPath: '/',
});

describe('request diagnostics machine', () => {
  test('exposes the state and edge graph consumed by Stateflow', () => {
    expect(diagnosticsMachine.stateTags).toEqual([
      'Idle',
      'Loading',
      'Cancelling',
      'Ready',
      'Selecting',
      'Filtered',
      'Failed',
    ]);
    expect(diagnosticsMachine.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'Loading',
          messageTag: 'LoadedMetrics',
          target: 'Ready',
        }),
        expect.objectContaining({
          from: 'Loading',
          messageTag: 'Navigated',
          target: 'Cancelling',
        }),
        expect.objectContaining({
          from: 'Cancelling',
          messageTag: 'CompletedCancelFetchMetrics',
          target: 'Idle',
        }),
      ]),
    );
  });

  test('has no unreachable states from its initial state', () => {
    expect(diagnosticsMachine.unreachableStates()).toEqual([]);
  });

  test('has no dead transitions in its declared graph', () => {
    expect(diagnosticsMachine.deadTransitions()).toEqual([]);
  });

  test('loads data from the loading state', () => {
    const result = diagnosticsMachine.step(
      { _tag: 'Loading' },
      Message.LoadedMetrics({ points: samplePoints }),
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
      Message.ChangedSelection({ domain: [100, 300] }),
    );

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Filtered',
      state: { _tag: 'Filtered', domain: [100, 300], allPoints: samplePoints },
    });
  });

  test('interrupts an in-flight metrics request before reloading', () => {
    const result = diagnosticsMachine.step({ _tag: 'Loading' }, Message.ClickedReload());

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

  test('reports every message the machine takes to a listening observatory', () => {
    const { commands } = update(initModel, Message.LoadedMetrics({ points: samplePoints }));

    expect(commands?.map(({ name }) => name)).toEqual(['ReportToObservatory']);
  });

  test('starts the replacement request from the interrupt outcome', () => {
    const { model, commands } = update(
      { ...initModel, explorer: { _tag: 'Cancelling', reason: 'Reload' } },
      Message.CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
    );

    expect(model.explorer).toEqual({ _tag: 'Loading' });
    expect(machineCommands(commands)).toMatchObject([{ name: 'FetchMetrics', mode: 'switch' }]);
  });

  test('does not replace metrics work after route-exit cancellation', () => {
    const { model, commands } = update(
      { ...initModel, explorer: { _tag: 'Cancelling', reason: 'RouteExit' } },
      Message.CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } }),
    );

    expect(model.explorer).toEqual({ _tag: 'Idle' });
    expect(machineCommands(commands)).toEqual([]);
  });

  test('does not interrupt completed metrics work on route exit', () => {
    const { model, commands } = update(
      { ...initModel, explorer: { _tag: 'Ready', points: samplePoints } },
      exited,
    );

    expect(model.explorer).toEqual({ _tag: 'Ready', points: samplePoints });
    expect(machineCommands(commands)).toEqual([]);
  });

  test('ignores a late successful load after route-exit cancellation', () => {
    const model = { ...initModel, explorer: ExplorerState.Idle() };
    const { model: nextModel, commands } = update(
      model,
      Message.LoadedMetrics({ points: samplePoints }),
    );

    expect(nextModel.explorer).toBe(model.explorer);
    expect(nextModel.histogram).toBe(model.histogram);
    expect(nextModel.scatter).toBe(model.scatter);
    expect(nextModel.lastTransition).toBe('LoadedMetrics ignored in Idle');
    expect(machineCommands(commands)).toEqual([]);
  });

  test('restores all points when a filtered selection is cleared', () => {
    const result = diagnosticsMachine.step(
      {
        _tag: 'Filtered',
        points: samplePoints.slice(0, 2),
        allPoints: samplePoints,
        domain: [100, 300],
      },
      Message.ClearedSelection(),
    );

    expect(result).toMatchObject({
      _tag: 'Transitioned',
      target: 'Ready',
      state: { _tag: 'Ready', points: samplePoints },
    });
  });

  describe('revisiting the route', () => {
    const entered = Message.Navigated({
      phase: 'entered',
      path: '/request-diagnostics',
      previousPath: '/',
    });
    const interrupted = Message.CompletedCancelFetchMetrics({ outcome: { _tag: 'Interrupted' } });
    const step = (model: typeof initModel, message: Message) => update(model, message);

    test('loads again after leaving while the first load was in flight', () => {
      const idle = step(step(initModel, exited).model, interrupted).model;
      expect(idle.explorer._tag).toBe('Idle');
      const back = step(idle, entered);
      expect(back.model.explorer._tag).toBe('Loading');
      expect(machineCommands(back.commands).map(({ name }) => name)).toEqual(['FetchMetrics']);
    });

    test('keeps loaded data without fetching it again', () => {
      const ready = step(initModel, Message.LoadedMetrics({ points: samplePoints })).model;
      const back = step(step(ready, exited).model, entered);
      expect(back.model.explorer._tag).toBe('Ready');
      expect(machineCommands(back.commands)).toEqual([]);
    });

    test('keeps the brushed range and plotted requests across a return visit', () => {
      const outside = { x: 80, y: 1.2, label: 'outside' };
      const inside = { x: 150, y: 2.4, label: 'inside' };
      const points = [outside, inside];
      const domain = [100, 200] as const;
      const ready = step(initModel, Message.LoadedMetrics({ points })).model;
      const filtered = step(ready, Message.ChangedSelection({ domain })).model;

      const away = step(filtered, exited);
      const back = step(away.model, entered);
      expect(machineCommands(away.commands)).toEqual([]);
      expect(machineCommands(back.commands)).toEqual([]);
      expect(back.model.explorer).toMatchObject({ _tag: 'Filtered', domain });
      expect(rowsOf(back.model.scatter.spec.data ?? [])).toEqual([inside]);

      const cleared = step(back.model, Message.ClearedSelection());
      expect(rowsOf(cleared.model.scatter.spec.data ?? [])).toEqual(points);
    });

    test('tries a failed load again', () => {
      const failed = step(initModel, Message.FailedLoad({ error: 'offline' })).model;
      const back = step(failed, entered);
      expect(back.model.explorer._tag).toBe('Loading');
      expect(machineCommands(back.commands).map(({ name }) => name)).toEqual(['FetchMetrics']);
    });

    test('ignores navigation elsewhere', () => {
      const idle = step(step(initModel, exited).model, interrupted).model;
      const elsewhere = step(
        idle,
        Message.Navigated({ phase: 'entered', path: '/charts', previousPath: '/' }),
      );
      expect(elsewhere.model.explorer._tag).toBe('Idle');
      expect(machineCommands(elsewhere.commands)).toEqual([]);
    });

    test('shows the revisit edges to Stateflow', () => {
      expect(diagnosticsMachine.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: 'Idle', messageTag: 'Navigated', target: 'Loading' }),
          expect.objectContaining({ from: 'Failed', messageTag: 'Navigated', target: 'Loading' }),
        ]),
      );
    });
  });
});
