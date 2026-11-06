import { parseGraph, serializeGraph } from '@opsydyn/foldkit-flow';
import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';
import { ColorScheme } from './model';

const colorSchemeKey = 'opsydyn.foldkit-flow.color-scheme.v1';

export const LoadColorScheme = Command.define('LoadColorScheme', {
  messages: [Message.LoadedColorScheme],
  execute: Effect.try(() => globalThis.localStorage.getItem(colorSchemeKey)).pipe(
    Effect.match({
      onSuccess: (stored) => (Schema.is(ColorScheme)(stored) ? stored : null),
      onFailure: () => null,
    }),
    Effect.map((stored) =>
      Message.LoadedColorScheme({
        colorScheme:
          stored ??
          (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      }),
    ),
  ),
});

export const SaveColorScheme = Command.define('SaveColorScheme', {
  args: { colorScheme: ColorScheme },
  messages: [Message.CompletedColorSchemeSave, Message.FailedColorSchemeSave],
  execute: ({ colorScheme }) =>
    Effect.try(() => globalThis.localStorage.setItem(colorSchemeKey, colorScheme)).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedColorSchemeSave(),
        onFailure: () => Message.FailedColorSchemeSave(),
      }),
    ),
});

export const ArrangeFlow = Command.define('ArrangeFlow', {
  args: {
    json: Schema.String,
    requestId: Schema.String,
    revision: Schema.Number,
    engine: Schema.Literals(['elk', 'force']),
    direction: Schema.Literals(['RIGHT', 'DOWN']),
  },
  interrupt: true,
  messages: [Message.SucceededLayout, Message.FailedLayout],
  execute: ({ json, requestId, revision, direction, engine }) =>
    Effect.tryPromise(async () => {
      const request = { requestId, revision, graph: parseGraph(json) };
      if (engine === 'force') {
        // oxlint-disable-next-line linteffect/prevent-dynamic-imports
        const { createForceLayout } = await import('@opsydyn/foldkit-flow-force');
        return createForceLayout()(request);
      }
      // oxlint-disable-next-line linteffect/prevent-dynamic-imports
      const { createElkLayout } = await import('@opsydyn/foldkit-flow-elk');
      return createElkLayout({ direction, spacing: 32 })(request);
    }).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededLayout({ result }),
        onFailure: () => Message.FailedLayout({ requestId }),
      }),
    ),
});
export const SaveFlow = Command.define('SaveFlow', {
  args: { json: Schema.String },
  messages: [Message.SucceededSave, Message.FailedStorage],
  execute: ({ json }) =>
    Effect.try(() =>
      globalThis.localStorage.setItem('opsydyn.foldkit-flow.release-sample.v1', json),
    ).pipe(
      Effect.match({
        onSuccess: () => Message.SucceededSave(),
        onFailure: () => Message.FailedStorage(),
      }),
    ),
});
export const LoadFlow = Command.define('LoadFlow', {
  messages: [Message.SucceededLoad, Message.FailedStorage],
  execute: Effect.try(() =>
    serializeGraph(
      parseGraph(
        globalThis.localStorage.getItem('opsydyn.foldkit-flow.release-sample.v1') ?? 'null',
      ),
    ),
  ).pipe(
    Effect.match({
      onSuccess: (json) => Message.SucceededLoad({ json }),
      onFailure: () => Message.FailedStorage(),
    }),
  ),
});

export const ImportFlow = Command.define('ImportFlow', {
  args: { id: Schema.Number, file: Schema.instanceOf(File) },
  interrupt: true,
  messages: [Message.SucceededImport, Message.FailedImport],
  execute: ({ id, file }) =>
    Effect.tryPromise(() => file.text().then((text) => serializeGraph(parseGraph(text)))).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededImport({ id, json }),
        onFailure: () => Message.FailedImport({ id }),
      }),
    ),
});

export const ExportFlow = Command.define('ExportFlow', {
  args: { json: Schema.String },
  messages: [Message.CompletedExport, Message.FailedExport],
  execute: ({ json }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: 'foldkit-flow.json',
      });
      // Release after the browser has had time to start consuming the URL.
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedExport(),
        onFailure: () => Message.FailedExport(),
      }),
    ),
});
