import { Effect, Option } from 'effect';
import { Command } from 'foldkit';
import { afterEach, expect, it, vi } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel';
import { comparisonFolds } from './fold';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

/** A Command a panel might return, to check the parent keeps routing its completion. */
const ProbeInspection = Command.define('ProbeInspection', {
  messages: [PlotPanel.Message.BlurredTarget],
  execute: Effect.succeed(PlotPanel.Message.BlurredTarget()),
});

afterEach(() => vi.restoreAllMocks());

it('never invokes child updaters for missing or wrong-kind IDs', () => {
  const scatter = vi.fn(PlotPanel.update);
  const histogram = vi.fn(PlotPanel.update);
  const folds = comparisonFolds({ scatter, histogram });
  const model = init().model;
  for (const id of [2, 99])
    expect(folds.scatter(model, id, PlotPanel.Message.BlurredTarget())).toEqual({ model });
  for (const id of [1, 99])
    expect(folds.histogram(model, id, PlotPanel.Message.BlurredTarget())).toEqual({ model });
  expect(scatter).not.toHaveBeenCalled();
  expect(histogram).not.toHaveBeenCalled();
});

it('consumes scatter inspection once and keeps Command routing stable after reorder and removal', async () => {
  const scatter = vi.fn<typeof PlotPanel.update>((model, message) => ({
    ...PlotPanel.update(model, message),
    commands: [ProbeInspection()],
  }));
  const histogram = vi.fn(PlotPanel.update);
  const folds = comparisonFolds({ scatter, histogram });
  const base = init().model;
  const result = folds.scatter(base, 1, PlotPanel.Message.HoveredTarget({ index: 0 }));
  expect(scatter).toHaveBeenCalledTimes(1);
  expect(histogram).not.toHaveBeenCalled();
  expect(result.model.panels[1]).toBe(base.panels[1]);
  expect(result.model.linking).toEqual({
    _tag: 'Linked',
    inspection: Option.some({ sourceId: 1, value: { _tag: 'Point', key: 'salary-1' } }),
  });
  expect(result).not.toHaveProperty('outMessage');
  expect(result.commands).toHaveLength(1);
  const moved = update(result.model, Message.ClickedMovePanel({ id: 1, direction: 'later' })).model;
  const command = Option.getOrThrow(Option.fromNullishOr(result.commands?.[0]));
  const completion = await Effect.runPromise(command.effect);
  expect(completion).toEqual({
    _tag: 'GotScatterMessage',
    id: 1,
    message: { _tag: 'BlurredTarget' },
  });
  expect(update(moved, completion).model.linking).toEqual({
    _tag: 'Linked',
    inspection: Option.none(),
  });
  const removed = update(moved, Message.ClickedRemovePanel({ id: 1 })).model;
  const late = update(removed, completion);
  expect(late.model).toBe(removed);
  expect(late.commands ?? []).toEqual([]);
});

it('consumes histogram inspection once and preserves its keyed Command completion', async () => {
  const scatter = vi.fn(PlotPanel.update);
  const histogram = vi.fn<typeof PlotPanel.update>((model, message) => ({
    ...PlotPanel.update(model, message),
    commands: [ProbeInspection()],
  }));
  const folds = comparisonFolds({ scatter, histogram });
  const base = init().model;
  const result = folds.histogram(base, 2, PlotPanel.Message.HoveredTarget({ index: 0 }));
  expect(histogram).toHaveBeenCalledTimes(1);
  expect(scatter).not.toHaveBeenCalled();
  expect(result.model.panels[0]).toBe(base.panels[0]);
  expect(result.model.linking).toEqual({
    _tag: 'Linked',
    inspection: Option.some({
      sourceId: 2,
      value: { _tag: 'Range', lower: 55000, upper: 60000, includeEnd: false },
    }),
  });
  expect(result).not.toHaveProperty('outMessage');
  expect(result.commands).toHaveLength(1);
  const moved = update(
    result.model,
    Message.ClickedMovePanel({ id: 2, direction: 'earlier' }),
  ).model;
  const completion = await Effect.runPromise(
    Option.getOrThrow(Option.fromNullishOr(result.commands?.[0])).effect,
  );
  expect(completion).toEqual({
    _tag: 'GotHistogramMessage',
    id: 2,
    message: { _tag: 'BlurredTarget' },
  });
  const removed = update(moved, Message.ClickedRemovePanel({ id: 2 })).model;
  expect(update(removed, completion).model).toBe(removed);
  expect(update(removed, completion).commands ?? []).toEqual([]);
});

it('lifts both initial and dynamically added child Commands with their allocated IDs', async () => {
  const panelInit = PlotPanel.init;
  vi.spyOn(PlotPanel, 'init').mockImplementation((config) => ({
    ...panelInit(config),
    commands: [ProbeInspection()],
  }));
  const initial = init();
  expect(initial.commands).toHaveLength(2);
  const completions = await Promise.all(
    (initial.commands ?? []).map((command) => Effect.runPromise(command.effect)),
  );
  expect(completions).toEqual([
    { _tag: 'GotScatterMessage', id: 1, message: { _tag: 'BlurredTarget' } },
    { _tag: 'GotHistogramMessage', id: 2, message: { _tag: 'BlurredTarget' } },
  ]);
  for (const kind of ['scatter', 'histogram'] as const) {
    const added = update(initial.model, Message.ClickedAddPanel({ kind }));
    expect(added.commands).toHaveLength(2);
    expect(added.commands?.[1]).toMatchObject({
      name: 'FocusComparisonTarget',
      args: { selector: '#comparison-panel-3' },
    });
    const completion = await Effect.runPromise(
      Option.getOrThrow(Option.fromNullishOr(added.commands?.[0])).effect,
    );
    expect(completion).toEqual(
      kind === 'scatter'
        ? { _tag: 'GotScatterMessage', id: 3, message: { _tag: 'BlurredTarget' } }
        : { _tag: 'GotHistogramMessage', id: 3, message: { _tag: 'BlurredTarget' } },
    );
  }
});
