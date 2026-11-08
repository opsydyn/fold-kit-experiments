import { parseEditions } from '@opsydyn/foldkit-zloz';
import { parseGraph, parseSnapshot } from '@opsydyn/foldkit-zloz';
import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { editionArchiveByteLimit } from './history';
import { Message } from './message';
import { ThemePreference } from './model';
import { themePreferenceStorageKey } from './theme';

export const LoadThemePreference = Command.define('LoadThemePreference', {
  messages: [Message.LoadedThemePreference],
  execute: Effect.try(() => globalThis.localStorage.getItem(themePreferenceStorageKey)).pipe(
    Effect.match({
      onSuccess: (stored) =>
        Message.LoadedThemePreference({
          themePreference: Schema.is(ThemePreference)(stored) ? stored : 'system',
        }),
      onFailure: () => Message.LoadedThemePreference({ themePreference: 'system' }),
    }),
  ),
});

export const SaveThemePreference = Command.define('SaveThemePreference', {
  args: { themePreference: ThemePreference },
  messages: [Message.CompletedColorSchemeSave, Message.FailedColorSchemeSave],
  execute: ({ themePreference }) =>
    Effect.try(() =>
      globalThis.localStorage.setItem(themePreferenceStorageKey, themePreference),
    ).pipe(
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
        const { createForceLayout } = await import('@opsydyn/foldkit-zloz-force');
        return createForceLayout()(request);
      }
      // oxlint-disable-next-line linteffect/prevent-dynamic-imports
      const { createElkLayout } = await import('@opsydyn/foldkit-zloz-elk');
      return createElkLayout({ direction, spacing: 32 })(request);
    }).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededLayout({ result }),
        onFailure: () => Message.FailedLayout({ requestId }),
      }),
    ),
});
export const SaveZloz = Command.define('SaveZloz', {
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
export const LoadZloz = Command.define('LoadZloz', {
  messages: [Message.SucceededLoad, Message.FailedStorage],
  execute: Effect.try(() => {
    const json =
      globalThis.localStorage.getItem('opsydyn.foldkit-flow.release-sample.v1') ?? 'null';
    parseSnapshot(json);
    return json;
  }).pipe(
    Effect.match({
      onSuccess: (json) => Message.SucceededLoad({ json }),
      onFailure: () => Message.FailedStorage(),
    }),
  ),
});

export const ImportZloz = Command.define('ImportZloz', {
  args: { id: Schema.Number, file: Schema.instanceOf(File) },
  interrupt: true,
  messages: [Message.SucceededImport, Message.FailedImport],
  execute: ({ id, file }) =>
    Effect.tryPromise(() =>
      file.text().then((text) => {
        parseSnapshot(text);
        return text;
      }),
    ).pipe(
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
        download: 'foldkit-zloz.json',
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

export const ExportMermaidBundle = Command.define('ExportMermaidBundle', {
  args: { json: Schema.String },
  messages: [Message.CompletedMermaidDownload, Message.FailedMermaidDownload],
  execute: ({ json }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: 'foldkit-zloz.mermaid.json',
      });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedMermaidDownload(),
        onFailure: () => Message.FailedMermaidDownload(),
      }),
    ),
});

export const ExportZlozEditions = Command.define('ExportZlozEditions', {
  args: { json: Schema.String },
  messages: [Message.CompletedExportEditions, Message.FailedExportEditions],
  execute: ({ json }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: 'foldkit-zloz.editions.json',
      });
      // Release after the browser has had time to start consuming the URL.
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedExportEditions(),
        onFailure: () => Message.FailedExportEditions(),
      }),
    ),
});

class EditionArchiveTooLarge extends Data.TaggedError('EditionArchiveTooLarge')<{
  readonly byteLimit: number;
}> {}
export const ImportZlozEditions = Command.define('ImportZlozEditions', {
  args: { id: Schema.Number, file: Schema.instanceOf(File) },
  interrupt: { keyFields: ['id'], toKey: ({ id }) => String(id) },
  messages: [Message.SucceededEditionArchiveImport, Message.FailedEditionArchiveImport],
  execute: ({ id, file }) =>
    Effect.tryPromise(() => file.arrayBuffer()).pipe(
      Effect.filterOrFail(
        (buffer) => buffer.byteLength <= editionArchiveByteLimit,
        () => new EditionArchiveTooLarge({ byteLimit: editionArchiveByteLimit }),
      ),
      Effect.flatMap((buffer) =>
        Effect.try(() => parseEditions(new TextDecoder('utf-8', { fatal: true }).decode(buffer))),
      ),
      Effect.match({
        onSuccess: (editions) => Message.SucceededEditionArchiveImport({ id, editions }),
        onFailure: () => Message.FailedEditionArchiveImport({ id }),
      }),
    ),
});
