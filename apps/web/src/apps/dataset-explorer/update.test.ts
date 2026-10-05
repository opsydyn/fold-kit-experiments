import { Option, Result, Schema } from 'effect';
import { getData } from 'foldkit/asyncData';
import type { Return } from 'foldkit/update';
import { describe, expect, it } from 'vitest';

import { Request } from './data';
import { Message } from './message';
import { init } from './model';
import type { Model } from './model';
import { DatasetQuery } from './query';
import { update } from './update';

const commandInput = Schema.Struct({ args: Request, generation: Schema.Number });
const completion = (started: Return<Model, Message>, index = 0, failed = false): Message => {
  const input = Schema.decodeUnknownSync(commandInput)(started.commands?.[index]?.args);
  return Message.GotDatasetMessage({
    message: {
      _tag: 'CompletedFetch',
      args: input.args,
      generation: input.generation,
      result: failed
        ? Result.fail('Request failed')
        : Result.succeed({
            dataset: input.args.dataset,
            revision: input.args.revision,
            points: [
              { hour: 0, value: 7 },
              { hour: 2, value: 11 },
            ],
          }),
    },
  });
};
const visible = (model: Model) =>
  DatasetQuery.read(model.datasets, {
    dataset: model.selected,
    revision: 0,
    profile: 'normal',
    fail: false,
  });
const loaded = () => {
  const started = init();
  return update(started.model, completion(started)).model;
};

describe('dataset explorer query composition', () => {
  it('starts a cold HTTP load from init', () => {
    const started = init();
    expect(visible(started.model)._tag).toBe('Loading');
    expect(started.commands).toHaveLength(1);
    expect(started.commands?.[0]?.args).toMatchObject({ args: { dataset: 'north' } });
  });

  it('retains the displayed snapshot while refreshing', () => {
    const model = loaded();
    const refreshed = update(model, Message.ClickedRefresh());
    expect(visible(refreshed.model)._tag).toBe('Refreshing');
    expect(Option.getOrThrow(getData(visible(refreshed.model))).revision).toBe(1);
    const settled = update(refreshed.model, completion(refreshed)).model;
    expect(Option.getOrThrow(getData(visible(settled))).revision).toBe(2);
  });

  it('returns to a cached dataset without fetching again', () => {
    const north = loaded();
    const coast = update(north, Message.ClickedDataset({ dataset: 'coast' }));
    const coastLoaded = update(coast.model, completion(coast)).model;
    const returned = update(coastLoaded, Message.ClickedDataset({ dataset: 'north' }));
    expect(returned.model.selected).toBe('north');
    expect(returned.commands ?? []).toHaveLength(0);
    expect(Option.getOrThrow(getData(visible(returned.model))).revision).toBe(1);
  });

  it('folds a response into its own dataset after the selection changes', () => {
    const north = init();
    const coast = update(north.model, Message.ClickedDataset({ dataset: 'coast' }));
    const northFinished = update(coast.model, completion(north)).model;
    expect(northFinished.selected).toBe('coast');
    expect(visible(northFinished)._tag).toBe('Loading');
    const returned = update(northFinished, Message.ClickedDataset({ dataset: 'north' }));
    expect(returned.commands ?? []).toHaveLength(0);
    expect(Option.getOrThrow(getData(visible(returned.model))).dataset).toBe('north');
  });

  it('keeps the newer snapshot when the race demo receives the old response last', () => {
    const race = update(loaded(), Message.ClickedResponseRace());
    expect(race.commands).toHaveLength(2);
    const fast = update(race.model, completion(race, 1)).model;
    const slow = update(fast, completion(race, 0)).model;
    expect(Option.getOrThrow(getData(visible(slow))).revision).toBe(3);
    expect(slow.trace.slice(-2)).toEqual([
      { dataset: 'north', revision: 3, outcome: 'accepted' },
      { dataset: 'north', revision: 2, outcome: 'ignored' },
    ]);
  });

  it('retains usable data when a refresh fails, then recovers on retry', () => {
    const started = update(loaded(), Message.ClickedFailedRefresh());
    const stale = update(started.model, completion(started, 0, true)).model;
    expect(visible(stale)._tag).toBe('Stale');
    expect(Option.getOrThrow(getData(visible(stale))).revision).toBe(1);
    const retry = update(stale, Message.ClickedRefresh());
    const recovered = update(retry.model, completion(retry)).model;
    expect(visible(recovered)._tag).toBe('Success');
    expect(Option.getOrThrow(getData(visible(recovered))).revision).toBe(3);
  });
});
