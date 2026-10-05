import { afterAll, beforeAll, expect, test } from 'bun:test';
import { ok } from 'node:assert/strict';

import { Request } from '@opsydyn/dataset-explorer/data';
import { Message } from '@opsydyn/dataset-explorer/message';
import { init } from '@opsydyn/dataset-explorer/model';
import { DatasetQuery } from '@opsydyn/dataset-explorer/query';
import { sourceContent } from '@opsydyn/dataset-explorer/source';
import { update } from '@opsydyn/dataset-explorer/update';
import { view } from '@opsydyn/dataset-explorer/view';
import { Effect, pipe, Result, Schema } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { renderToString } from 'foldkit/experimental/server';

const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
beforeAll(() =>
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('http://localhost/examples/datasets/'),
  }),
);
afterAll(() => {
  if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
  else Reflect.deleteProperty(globalThis, 'location');
});

const testFetch = (run: (input: RequestInfo | URL) => Promise<Response>): typeof globalThis.fetch =>
  Object.assign(run, { preconnect: globalThis.fetch.preconnect });

const firstCommand = (started: ReturnType<typeof init>) => {
  const command = started.commands?.[0];
  ok(command, 'Expected a fetch Command');
  return command;
};

const render = (model: ReturnType<typeof init>['model']) =>
  pipe(
    renderToString(
      { Flags: Schema.Struct({}), init: () => ({ model }), view },
      { flags: {}, isHydratable: false },
    ),
    Effect.runPromise,
  );

test('resizing preserves pending requests and selected source without issuing commands', () => {
  const started = init({ transport: 'fixtures' });
  const selected = update(started.model, Message.SelectedSource({ name: 'snapshot.json' })).model;
  const resized = update(selected, Message.RecordedChartWidth({ width: 375.5 }));
  expect(resized.model.chartWidth).toBe(375.5);
  expect(resized.commands ?? []).toHaveLength(0);
  expect(resized.model.datasets).toBe(selected.datasets);
  expect(resized.model.trace).toBe(selected.trace);
  expect(resized.model.activeFile).toBe('snapshot.json');
  expect(resized.model.nextRevision).toBe(selected.nextRevision);
  for (const width of [375.5, 0, -1, 86, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(update(resized.model, Message.RecordedChartWidth({ width })).model).toBe(resized.model);
  }
});

test('narrow dataset charts reproject observations and reduce tick density without shrinking labels', async () => {
  const started = init({ transport: 'fixtures' });
  const ready = update(
    started.model,
    Message.GotDatasetMessage({
      message: DatasetQuery.Message.CompletedFetch({
        generation: 1,
        args: { source: 'fixtures', dataset: 'north', revision: 1, profile: 'normal', fail: false },
        result: Result.succeed({
          dataset: 'north',
          revision: 1,
          points: [
            { hour: 0, value: 0 },
            { hour: 14, value: 10 },
          ],
        }),
      }),
    }),
  ).model;
  const narrow = (await render({ ...ready, chartWidth: 320 })).html;
  const wide = (await render({ ...ready, chartWidth: 920 })).html;
  expect(narrow).toContain('viewBox="0 0 320 330"');
  expect(narrow).toContain('d="M58,272L292,24"');
  expect(wide).toContain('d="M58,272L892,24"');
  const hourTicks = (html: string) => [...html.matchAll(/>\d{2}:\d{2}<\/text>/g)].length;
  expect(hourTicks(narrow)).toBeLessThan(hourTicks(wide));
  expect(narrow).toContain('font-size="12"');
});

test('promo loads a static fixture through the generated Query command', async () => {
  const started = init({ transport: 'fixtures', sources: [] });
  const urls: string[] = [];
  const fetch = testFetch((input) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ dataset: 'north', points: [{ hour: 0, value: 4 }] }));
  });
  expect(started.commands?.length).toBe(1);
  const command = firstCommand(started);
  const message = await pipe(
    command.effect,
    Effect.provideService(FetchHttpClient.Fetch, fetch),
    Effect.runPromise,
  );
  const { html } = await render(update(started.model, message).model);
  expect(urls).toEqual(['http://localhost/datasets/north.json']);
  expect(html).toContain('Snapshot 1');
  expect(html).toContain('00:00: 4 m/s');
});

test('promo exposes the running source beside the live chart', async () => {
  const started = init({
    transport: 'fixtures',
    sources: [{ name: 'query.ts', content: 'export const runningQuery = true;' }],
  });
  const { html } = await render(started.model);
  expect(html).toContain('Running source');
  expect(html).toContain('export const runningQuery = true;');
  expect(html).toContain('snapshot.json');
});

test('the snapshot source follows retained, refreshed and newly selected data', async () => {
  const input = Schema.Struct({ args: Request, generation: Schema.Number });
  const finish = (started: ReturnType<typeof init>) => {
    const { args, generation } = Schema.decodeUnknownSync(input)(firstCommand(started).args);
    return update(
      started.model,
      Message.GotDatasetMessage({
        message: DatasetQuery.Message.CompletedFetch({
          args,
          generation,
          result: Result.succeed({
            dataset: args.dataset,
            revision: args.revision,
            points: [{ hour: 0, value: args.revision * 2 }],
          }),
        }),
      }),
    ).model;
  };
  const started = init({
    transport: 'fixtures',
    sources: [{ name: 'query.ts', content: 'actual query source' }],
  });
  const selected = update(started.model, Message.SelectedSource({ name: 'snapshot.json' })).model;
  expect(JSON.parse(sourceContent(selected))).toEqual({ state: 'Loading', dataset: 'north' });
  const loaded = finish({ ...started, model: selected });
  const refreshed = update(loaded, Message.ClickedRefresh());
  expect(JSON.parse(sourceContent(refreshed.model)).revision).toBe(1);
  const fresh = finish(refreshed);
  expect(JSON.parse(sourceContent(fresh)).revision).toBe(2);
  const coast = update(fresh, Message.ClickedDataset({ dataset: 'coast' }));
  expect(JSON.parse(sourceContent(coast.model))).toEqual({ state: 'Loading', dataset: 'coast' });
  const coastal = finish(coast);
  expect(JSON.parse(sourceContent(coastal))).toEqual({
    dataset: 'coast',
    revision: 3,
    points: [{ hour: 0, value: 6 }],
  });
  const north = update(coastal, Message.ClickedDataset({ dataset: 'north' }));
  expect(north.commands ?? []).toHaveLength(0);
  expect(JSON.parse(sourceContent(north.model)).revision).toBe(2);
  const code = update(north.model, Message.SelectedSource({ name: 'query.ts' })).model;
  expect(sourceContent(code)).toBe('actual query source');
  const { html } = await render(code);
  expect(html).toContain('actual query source');
});

test('corrupt and mismatched static responses produce a retryable failure', async () => {
  for (const payload of [
    { dataset: 'coast', points: [] },
    { dataset: 'north', points: [{ hour: 0, value: 'bad' }] },
  ]) {
    const started = init({ transport: 'fixtures' });
    const fetch = testFetch(() => Promise.resolve(Response.json(payload)));
    const message = await pipe(
      firstCommand(started).effect,
      Effect.provideService(FetchHttpClient.Fetch, fetch),
      Effect.runPromise,
    );
    const { html } = await render(update(started.model, message).model);
    expect(html).toContain('Failure');
    expect(html).toContain('Try refresh dataset.');
    expect(html).not.toContain('chart-line-series');
  }
});

test('a deliberate failure retains the loaded snapshot without fetching a replacement', async () => {
  const started = init({ transport: 'fixtures' });
  let fetches = 0;
  const fetch = testFetch(() => {
    fetches += 1;
    return Promise.resolve(Response.json({ dataset: 'north', points: [{ hour: 0, value: 9 }] }));
  });
  const run = (command: NonNullable<ReturnType<typeof init>['commands']>[number]) =>
    pipe(command.effect, Effect.provideService(FetchHttpClient.Fetch, fetch), Effect.runPromise);
  const loaded = update(started.model, await run(firstCommand(started))).model;
  const failed = update(loaded, Message.ClickedFailedRefresh());
  const stale = update(failed.model, await run(firstCommand(failed))).model;
  const { html } = await render(stale);
  expect(fetches).toBe(1);
  expect(html).toContain('Stale');
  expect(html).toContain('Snapshot 1');
  expect(html).toContain('00:00: 9 m/s');
  expect(html).toContain('Your last snapshot stays visible.');
});

test('fixture requests use the deployed promo directory', async () => {
  const started = init({
    transport: 'fixtures',
    fixturesUrl: '/fold-kit-experiments/viz/datasets/',
  });
  const urls: string[] = [];
  const fetch = testFetch((input) => {
    urls.push(String(input));
    return Promise.resolve(Response.json({ dataset: 'north', points: [{ hour: 0, value: 4 }] }));
  });
  const message = await pipe(
    firstCommand(started).effect,
    Effect.provideService(FetchHttpClient.Fetch, fetch),
    Effect.runPromise,
  );
  expect(urls).toEqual(['http://localhost/fold-kit-experiments/viz/datasets/north.json']);
  expect((await render(update(started.model, message).model)).html).toContain('Snapshot 1');
});
