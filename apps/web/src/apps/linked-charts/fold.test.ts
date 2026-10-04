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
