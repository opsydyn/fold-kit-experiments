import { Effect, Option } from 'effect';
import { Command } from 'foldkit';
import { expect, it } from 'vitest';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { linkedChartFolds } from './fold';
import { init } from './model';

const ProbeInspection = Command.define('ProbeInspection', {
  messages: [Scatter.Message.BlurredPoint],
  execute: Effect.succeed(Scatter.Message.BlurredPoint()),
});

const ProbeRangeInspection = Command.define('ProbeRangeInspection', {
  messages: [Histogram.Message.BlurredBin],
  execute: Effect.succeed(Histogram.Message.BlurredBin()),
});

it('preserves histogram Command completion mapping while storing the range overlay', async () => {
  const decoratedHistogram: typeof Histogram.update = (model, message) => ({
    ...Histogram.update(model, message),
    commands: [ProbeRangeInspection()],
  });
  const folds = linkedChartFolds({ scatter: Scatter.update, histogram: decoratedHistogram });
  const model = init().model;
  const result = folds.histogram(model, Histogram.Message.HoveredBin({ index: 0 }));
  expect(result.model.scatter).toBe(model.scatter);
  expect(result.model.inspection).toEqual(
    Option.some({
      _tag: 'Range',
      lower: 55000,
      upper: 60000,
      includeEnd: false,
    }),
  );
  expect(result.commands).toHaveLength(1);
  const command = Option.getOrThrow(Option.fromNullishOr(result.commands?.[0]));
  expect(await Effect.runPromise(command.effect)).toEqual({
    _tag: 'ReceivedHistogramMessage',
    message: { _tag: 'BlurredBin' },
  });
});

it('preserves child Commands and folds their completion while applying the inspection event', async () => {
  const decoratedScatter: typeof Scatter.update = (model, message) => ({
    ...Scatter.update(model, message),
    commands: [ProbeInspection()],
  });
  const folds = linkedChartFolds({ scatter: decoratedScatter, histogram: Histogram.update });
  const result = folds.scatter(init().model, Scatter.Message.HoveredPoint({ index: 0 }));
  expect(result.model.histogram.activeBin).toEqual(Option.some(0));
  expect(result.commands).toHaveLength(1);
  const command = Option.getOrThrow(Option.fromNullishOr(result.commands?.[0]));
  const completion = await Effect.runPromise(command.effect);
  expect(completion).toEqual({ _tag: 'ReceivedScatterMessage', message: { _tag: 'BlurredPoint' } });
});
