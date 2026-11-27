import { Request } from '@opsydyn/dataset-explorer/data';
import { Message } from '@opsydyn/dataset-explorer/message';
import { init } from '@opsydyn/dataset-explorer/model';
import type { Model } from '@opsydyn/dataset-explorer/model';
import { DatasetQuery, status } from '@opsydyn/dataset-explorer/query';
import { update } from '@opsydyn/dataset-explorer/update';
import { Result, Schema } from 'effect';
import { describe, expect, it } from 'vitest';

const commandInput = Schema.Struct({ args: Request, generation: Schema.Number });
const completion = (started: ReturnType<typeof update>, index = 0, failed = false): Message => {
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
  });
const loaded = () => {
  const started = init();
  return update(started.model, completion(started)).model;
};

describe('dataset explorer query composition', () => {
  it('starts a cold HTTP load from init', () => {
    const started = init();
    expect(status(visible(started.model))).toBe('Loading');
    expect(started.commands).toHaveLength(1);
    expect(started.commands?.[0]?.args).toMatchObject({ args: { dataset: 'north' } });
  });

  it('retains the displayed snapshot while refreshing', () => {
    const model = loaded();
    const refreshed = update(model, Message.ClickedRefresh());
    expect(status(visible(refreshed.model))).toBe('Refreshing');
    expect(visible(refreshed.model).snapshot?.revision).toBe(1);
    const settled = update(refreshed.model, completion(refreshed)).model;
    expect(visible(settled).snapshot?.revision).toBe(2);
  });

  it('returns to a cached dataset without fetching again', () => {
    const north = loaded();
    const coast = update(north, Message.ClickedDataset({ dataset: 'coast' }));
    const coastLoaded = update(coast.model, completion(coast)).model;
    const returned = update(coastLoaded, Message.ClickedDataset({ dataset: 'north' }));
    expect(returned.model.selected).toBe('north');
    expect(returned.commands ?? []).toHaveLength(0);
    expect(visible(returned.model).snapshot?.revision).toBe(1);
  });

  it('folds a response into its own dataset after the selection changes', () => {
    const north = init();
    const coast = update(north.model, Message.ClickedDataset({ dataset: 'coast' }));
    const northFinished = update(coast.model, completion(north)).model;
    expect(northFinished.selected).toBe('coast');
    expect(status(visible(northFinished))).toBe('Loading');
    const returned = update(northFinished, Message.ClickedDataset({ dataset: 'north' }));
    expect(returned.commands ?? []).toHaveLength(0);
    expect(visible(returned.model).snapshot?.dataset).toBe('north');
  });

  it('keeps the newer snapshot when the race demo receives the old response last', () => {
    const race = update(loaded(), Message.ClickedResponseRace());
    expect(race.commands).toHaveLength(2);
    const fast = update(race.model, completion(race, 1)).model;
    const slow = update(fast, completion(race, 0)).model;
    expect(visible(slow).snapshot?.revision).toBe(3);
    expect(slow.trace.slice(-2)).toEqual([
      { dataset: 'north', revision: 3, outcome: 'accepted' },
      { dataset: 'north', revision: 2, outcome: 'ignored' },
    ]);
  });

  it('retains usable data when a refresh fails, then recovers on retry', () => {
    const started = update(loaded(), Message.ClickedFailedRefresh());
    const stale = update(started.model, completion(started, 0, true)).model;
    expect(status(visible(stale))).toBe('Stale');
    expect(visible(stale).snapshot?.revision).toBe(1);
    const retry = update(stale, Message.ClickedRefresh());
    const recovered = update(retry.model, completion(retry)).model;
    expect(status(visible(recovered))).toBe('Success');
    expect(visible(recovered).snapshot?.revision).toBe(3);
  });
});
