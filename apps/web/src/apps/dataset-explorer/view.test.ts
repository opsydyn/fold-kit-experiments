import { Effect, pipe, Result, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { init, Model } from './model';
import { DatasetQuery } from './query';
import { update } from './update';
import { view } from './view';

const render = (model: Model) =>
  pipe(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model }),
        view,
      },
      { flags: {}, isHydratable: false },
    ),
    Effect.runPromise,
  );

const ready = () => {
  const started = init();
  return update(
    started.model,
    Message.GotDatasetMessage({
      message: {
        _tag: 'CompletedFetch',
        generation: 1,
        args: { dataset: 'north', revision: 1, profile: 'normal', fail: false },
        result: Result.succeed({
          dataset: 'north',
          revision: 1,
          points: [
            { hour: 0, value: 4 },
            { hour: 2, value: 7 },
          ],
        }),
      },
    }),
  ).model;
};

describe('dataset explorer rendering', () => {
  it('offers retry without claiming a retained snapshot on cold failure', async () => {
    const started = init();
    const model = update(
      started.model,
      Message.GotDatasetMessage({
        message: DatasetQuery.Message.CompletedFetch({
          generation: 1,
          args: { dataset: 'north', revision: 1, profile: 'normal', fail: false },
          result: Result.fail('Request failed'),
        }),
      }),
    ).model;
    const { html } = await render(model);
    expect(html).toContain('Failure');
    expect(html).toContain('Try refresh dataset.');
    expect(html).not.toContain('Your last snapshot stays visible');
    expect(html).not.toContain('chart-line-series');
  });

  it('renders raw observations through chart layers while refreshing', async () => {
    const refreshing = update(ready(), Message.ClickedRefresh()).model;
    const { html } = await render(refreshing);
    expect(html).toContain('Refreshing');
    expect(html).toContain('Snapshot 1');
    expect(html).toContain('Wind observations');
    expect(html).toContain('00:00: 4 m/s');
    expect(html).toContain('chart-line-series');
    expect(html).toContain('chart-data-table');
  });

  it('keeps the chart and retry controls visible after a refresh failure', async () => {
    const failed = update(ready(), Message.ClickedFailedRefresh());
    const message = DatasetQuery.Message.CompletedFetch({
      generation: 2,
      args: { dataset: 'north', revision: 2, profile: 'normal', fail: true },
      result: Result.fail('Request failed'),
    });
    const stale = update(failed.model, Message.GotDatasetMessage({ message })).model;
    const { html } = await render(stale);
    expect(html).toContain('Stale');
    expect(html).toContain('Request failed');
    expect(html).toContain('Wind observations');
    expect(html).toContain('Refresh dataset');
  });
});
