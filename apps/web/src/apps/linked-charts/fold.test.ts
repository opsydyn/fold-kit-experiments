import { Effect, Option } from 'effect';
import { Command } from 'foldkit';
import { expect, it } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel';
import { linkedChartFolds } from './fold';
import { init } from './model';

const ProbeInspection = Command.define('ProbeInspection', {
  messages: [PlotPanel.Message.BlurredTarget],
  execute: Effect.succeed(PlotPanel.Message.BlurredTarget()),
});

it('preserves histogram Command completion mapping while storing the range overlay', async () => {
  const decoratedHistogram: typeof PlotPanel.update = (model, message) => ({
    ...PlotPanel.update(model, message),
    commands: [ProbeInspection()],
  });
  const folds = linkedChartFolds({ scatter: PlotPanel.update, histogram: decoratedHistogram });
  const model = init().model;
  const result = folds.histogram(model, PlotPanel.Message.HoveredTarget({ index: 0 }));
  expect(result.model.scatter).toBe(model.scatter);
  const [first] = PlotPanel.targetsOf(model.histogram);
  expect(result.model.inspection).toEqual(
    Option.some({
      _tag: 'Range',
      lower: first?.domain[0],
      upper: first?.domain[1],
      includeEnd: false,
    }),
  );
  expect(result.commands).toHaveLength(1);
  const command = Option.getOrThrow(Option.fromNullishOr(result.commands?.[0]));
  expect(await Effect.runPromise(command.effect)).toEqual({
    _tag: 'ReceivedHistogramMessage',
    message: { _tag: 'BlurredTarget' },
  });
});

it('preserves child Commands and folds their completion while applying the inspection event', async () => {
  const decoratedScatter: typeof PlotPanel.update = (model, message) => ({
    ...PlotPanel.update(model, message),
    commands: [ProbeInspection()],
  });
  const folds = linkedChartFolds({ scatter: decoratedScatter, histogram: PlotPanel.update });
  const result = folds.scatter(init().model, PlotPanel.Message.HoveredTarget({ index: 0 }));
  expect(result.model.histogram.active).toEqual(Option.some(0));
  expect(result.commands).toHaveLength(1);
  const command = Option.getOrThrow(Option.fromNullishOr(result.commands?.[0]));
  const completion = await Effect.runPromise(command.effect);
  expect(completion).toEqual({
    _tag: 'ReceivedScatterMessage',
    message: { _tag: 'BlurredTarget' },
  });
});
