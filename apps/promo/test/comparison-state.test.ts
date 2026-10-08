// Restore browser boundary spies even when assertions fail.
/* oxlint-disable linteffect/no-try-catch */
import { expect, test, spyOn } from 'bun:test';

import sdk from '@stackblitz/sdk';
import { Effect, Option, Schema } from 'effect';
import { Command } from 'foldkit';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import * as Comparison from '../../web/src/apps/comparison/main';
import * as Scatter from '../../web/src/ui/scatter-chart';
import { init, Message, update, view } from '../src/examples/comparison/main';
import { captureSettings } from '../src/examples/comparison/project';
import { settingsSource } from '../src/examples/comparison/project';
import { currentSource } from '../src/examples/comparison/update';

const props = {
  sources: [{ name: 'web/src/apps/comparison/initial-settings.ts', content: 'original' }],
  templateUrl: '/downloads/comparison-template.json',
};
const child = (message: Comparison.Message) => Message.GotWorkbenchMessage({ message });

test('delayed template fetch exports the original snapshot and completion keeps later edits', async () => {
  const response = Promise.withResolvers<Response>();
  const fetcher = spyOn(globalThis, 'fetch').mockReturnValue(response.promise);
  const opened = spyOn(sdk, 'openProject').mockImplementation(() => {});
  try {
    const base = init(props).model;
    const started = update(base, Message.ClickedPlayground());
    const completion = Effect.runPromise(
      Option.getOrThrow(Option.fromNullishOr(started.commands?.[0])).effect,
    );
    const edited = update(
      started.model,
      child(Comparison.Message.ClickedAddPanel({ kind: 'scatter' })),
    ).model;
    response.resolve(
      Response.json({ 'src/web/src/apps/comparison/initial-settings.ts': 'template default' }),
    );
    const finished = update(edited, await completion).model;
    expect(finished.actionStatus).toEqual({ _tag: 'Succeeded', action: 'playground' });
    expect(finished.workbench).toBe(edited.workbench);
    const delivered = Option.getOrThrow(Option.fromNullishOr(opened.mock.calls[0]))[0];
    expect(delivered.files['src/web/src/apps/comparison/initial-settings.ts']).toBe(
      settingsSource(captureSettings(base.workbench)),
    );
    expect(delivered.files['src/web/src/apps/comparison/initial-settings.ts']).not.toBe(
      settingsSource(captureSettings(finished.workbench)),
    );
  } finally {
    fetcher.mockRestore();
    opened.mockRestore();
  }
});

test('copy Command delivers the selected maintained source to the clipboard', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const copied: Array<string> = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (source: string) => {
          copied.push(source);
        },
      },
    },
  });
  try {
    const sources = [
      { name: 'web/src/apps/comparison/view.ts', content: 'maintained view source' },
    ];
    const model = init({ ...props, sources }).model;
    const started = update(model, Message.ClickedCopy());
    const completion = await Effect.runPromise(
      Option.getOrThrow(Option.fromNullishOr(started.commands?.[0])).effect,
    );
    expect(copied).toEqual(['maintained view source']);
    expect(completion).toEqual(Message.SucceededAction({ action: 'copy' }));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('export captures settings at Command creation while edits, source changes and completion retain live state', () => {
  const base = init(props).model;
  const started = update(base, Message.ClickedDownload());
  expect(started.commands).toHaveLength(1);
  expect(started.commands?.[0]).toMatchObject({
    args: { settings: captureSettings(base.workbench) },
  });
  const edited = update(
    started.model,
    child(Comparison.Message.ClickedAddPanel({ kind: 'scatter' })),
  ).model;
  const moved = update(
    edited,
    child(Comparison.Message.ClickedMovePanel({ id: 1, direction: 'later' })),
  ).model;
  const selected = update(
    moved,
    Message.SelectedFile({ name: 'web/src/apps/comparison/initial-settings.ts' }),
  ).model;
  expect(selected.actionStatus).toEqual({ _tag: 'Pending', action: 'download' });
  for (const message of [
    Message.ClickedCopy(),
    Message.ClickedDownload(),
    Message.ClickedPlayground(),
  ])
    expect(update(selected, message)).toEqual({ model: selected });
  const finished = update(selected, Message.SucceededAction({ action: 'download' })).model;
  expect(finished.workbench).toBe(selected.workbench);
  expect(finished.workbench.panels.map(({ id }) => id)).toEqual([2, 1, 3]);
  expect(started.commands?.[0]).toMatchObject({
    args: {
      settings: {
        panels: [
          { id: 1, kind: 'scatter' },
          { id: 2, kind: 'histogram' },
        ],
        nextPanelId: 3,
      },
    },
  });
  expect(currentSource(finished)).toContain('"nextPanelId": 4');
  expect(update(finished, Message.SelectedFile({ name: '../../secret' })).model).toBe(finished);
  expect(update(finished, Message.ClickedCopy()).commands?.[0]).toMatchObject({
    args: { source: currentSource(finished) },
  });
});

test('failed export permits retry and does not disable workbench editing', async () => {
  const fetcher = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
  try {
    const started = update(init(props).model, Message.ClickedPlayground());
    const completion = await Effect.runPromise(
      Option.getOrThrow(Option.fromNullishOr(started.commands?.[0])).effect,
    );
    expect(completion._tag).toBe('FailedAction');
    const failed = update(started.model, completion).model;
    const edited = update(failed, child(Comparison.Message.ClickedRemovePanel({ id: 1 }))).model;
    expect(edited.workbench.panels.map(({ id }) => id)).toEqual([2]);
    expect(update(edited, Message.ClickedDownload()).commands).toHaveLength(1);
  } finally {
    fetcher.mockRestore();
  }
});

test('wrapper forwards delayed panel-keyed child Commands without recreating removed panels', async () => {
  const Probe = Command.define('Probe', {
    messages: [Comparison.Message.GotScatterMessage],
    execute: Effect.succeed(
      Comparison.Message.GotScatterMessage({ id: 1, message: Scatter.Message.BlurredPoint() }),
    ),
  });
  const original = Comparison.update;
  const updater = spyOn(Comparison, 'update').mockImplementation((model, message) => ({
    ...original(model, message),
    commands: [Probe()],
  }));
  const result = update(
    init(props).model,
    child(
      Comparison.Message.GotScatterMessage({
        id: 1,
        message: Scatter.Message.HoveredPoint({ index: 0 }),
      }),
    ),
  );
  updater.mockRestore();
  expect(result.commands).toHaveLength(1);
  const removed = update(
    result.model,
    child(Comparison.Message.ClickedRemovePanel({ id: 1 })),
  ).model;
  const completion = await Effect.runPromise(
    Option.getOrThrow(Option.fromNullishOr(result.commands?.[0])).effect,
  );
  expect(completion).toEqual(
    child(Comparison.Message.GotScatterMessage({ id: 1, message: Scatter.Message.BlurredPoint() })),
  );
  const late = update(removed, completion);
  expect(late.model.workbench).toBe(removed.workbench);
  expect(late.commands ?? []).toEqual([]);
  expect(late.model.workbench.panels.map(({ id }) => id)).toEqual([2]);
});

test('standalone view renders shared workbench first with no recursive export actions', async () => {
  const model = init({ ...props, templateUrl: null }).model;
  expect(update(model, Message.ClickedDownload())).toEqual({ model });
  expect(update(model, Message.ClickedPlayground())).toEqual({ model });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model }),
        view: (state: typeof model, h: HtmlBuilder<Message>) => view(state, h),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(result.html).toContain('Scatter 1');
  expect(result.html).toContain('Histogram 2');
  expect(result.html.indexOf('comparison-toolbar')).toBeLessThan(
    result.html.indexOf('comparison-source'),
  );
  expect(result.html).not.toContain('Download project');
  expect(result.html).not.toContain('Open in StackBlitz');
});
