import type {
  ZlozPngRenderPayload,
  ZlozPngArtifact,
  ZlozPngRenderResult,
} from '@opsydyn/foldkit-zloz';
import { parseEditions, parseModelDocument } from '@opsydyn/foldkit-zloz';
import { parseGraph, parseSnapshot } from '@opsydyn/foldkit-zloz';
import { renderPngExport, downloadPngArtifact } from '@opsydyn/foldkit-zloz/browser';
import { Data, Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { alchemyTextLimits } from './alchemy-text';
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
  args: { id: Schema.Number },
  messages: [Message.SucceededImport, Message.FailedImport],
  execute: ({ id }) =>
    Effect.try(() => {
      const json =
        globalThis.localStorage.getItem('opsydyn.foldkit-flow.release-sample.v1') ?? 'null';
      parseSnapshot(json);
      return json;
    }).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededImport({ id, json }),
        onFailure: () => Message.FailedImport({ id }),
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

export const ExportZlozModel = Command.define('ExportZlozModel', {
  args: { json: Schema.String },
  messages: [Message.CompletedExport, Message.FailedExport],
  execute: ({ json }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: 'foldkit-zloz.model.json',
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

export const ExportReviewPacket = Command.define('ExportReviewPacket', {
  args: { json: Schema.String },
  messages: [Message.CompletedReviewPacketDownload, Message.FailedReviewPacketDownload],
  execute: ({ json }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: 'foldkit-zloz.review.json',
      });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedReviewPacketDownload(),
        onFailure: () => Message.FailedReviewPacketDownload(),
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

export const ImportZlozModel = Command.define('ImportZlozModel', {
  args: { id: Schema.Number, file: Schema.instanceOf(File) },
  interrupt: { keyFields: ['id'], toKey: ({ id }) => String(id) },
  messages: [Message.SucceededModelDocumentImport, Message.FailedModelDocumentImport],
  execute: ({ id, file }) =>
    Effect.tryPromise(() => file.arrayBuffer()).pipe(
      Effect.filterOrFail(
        (buffer) => buffer.byteLength <= editionArchiveByteLimit,
        () => new EditionArchiveTooLarge({ byteLimit: editionArchiveByteLimit }),
      ),
      Effect.flatMap((buffer) =>
        Effect.try(() =>
          parseModelDocument(new TextDecoder('utf-8', { fatal: true }).decode(buffer)),
        ),
      ),
      Effect.match({
        onSuccess: (document) => Message.SucceededModelDocumentImport({ id, document }),
        onFailure: () => Message.FailedModelDocumentImport({ id }),
      }),
    ),
});

export const DownloadConversionReceipt = Command.define('DownloadConversionReceipt', {
  args: {
    json: Schema.String,
    sequence: Schema.Number,
    modelId: Schema.String,
    epoch: Schema.Number,
    receiptId: Schema.String,
  },
  messages: [Message.CompletedConversionReceiptDownload, Message.FailedConversionReceiptDownload],
  execute: ({ json, sequence, modelId, epoch, receiptId }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `foldkit-zloz.conversion-${sequence}.json`,
      });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedConversionReceiptDownload({ modelId, epoch, receiptId }),
        onFailure: () => Message.FailedConversionReceiptDownload({ modelId, epoch, receiptId }),
      }),
    ),
});

export const DownloadC4Receipt = Command.define('DownloadC4Receipt', {
  args: {
    json: Schema.String,
    index: Schema.Number,
    modelId: Schema.String,
    epoch: Schema.Number,
  },
  messages: [Message.CompletedC4ReceiptDownload, Message.FailedC4ReceiptDownload],
  execute: ({ json, index, modelId, epoch }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `foldkit-zloz.c4-conversion-${index + 1}.json`,
      });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedC4ReceiptDownload({ modelId, epoch, index }),
        onFailure: () => Message.FailedC4ReceiptDownload({ modelId, epoch, index }),
      }),
    ),
});

export const ReadConversionReceipt = Command.define('ReadConversionReceipt', {
  args: { id: Schema.Number, file: Schema.instanceOf(File) },
  messages: [Message.SucceededConversionReceiptRead, Message.FailedConversionReceiptRead],
  execute: ({ id, file }) =>
    Effect.gen(function* () {
      if (file.size > editionArchiveByteLimit)
        return yield* Effect.fail(
          new EditionArchiveTooLarge({ byteLimit: editionArchiveByteLimit }),
        );
      const buffer = yield* Effect.tryPromise(() => file.arrayBuffer());
      if (buffer.byteLength > editionArchiveByteLimit)
        return yield* Effect.fail(
          new EditionArchiveTooLarge({ byteLimit: editionArchiveByteLimit }),
        );
      return yield* Effect.try(() => new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    }).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededConversionReceiptRead({ id, json }),
        onFailure: () => Message.FailedConversionReceiptRead({ id }),
      }),
    ),
});

export const DownloadSvg = Command.define('DownloadSvg', {
  args: {
    svg: Schema.String,
    fileName: Schema.String,
    scope: Schema.String,
    generation: Schema.Number,
    key: Schema.String,
    run: Schema.Number,
  },
  messages: [Message.CompletedSvgDownload, Message.FailedSvgDownload],
  execute: ({ svg, fileName, scope, generation, key, run }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedSvgDownload({ scope, generation, key, run }),
        onFailure: () => Message.FailedSvgDownload({ scope, generation, key, run }),
      }),
    ),
});

export const ReadReviewPacket = Command.define('ReadReviewPacket', {
  args: {
    scope: Schema.String,
    run: Schema.Number,
    maxBytes: Schema.Number,
    file: Schema.instanceOf(File),
  },
  messages: [Message.SucceededReviewPacketRead, Message.FailedReviewPacketRead],
  execute: ({ scope, run, maxBytes, file }) =>
    Effect.gen(function* () {
      if (file.size > maxBytes)
        return yield* Effect.fail(new EditionArchiveTooLarge({ byteLimit: maxBytes }));
      const buffer = yield* Effect.tryPromise(() => file.arrayBuffer());
      if (buffer.byteLength > maxBytes)
        return yield* Effect.fail(new EditionArchiveTooLarge({ byteLimit: maxBytes }));
      return yield* Effect.try(() => new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    }).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededReviewPacketRead({ scope, run, json }),
        onFailure: () => Message.FailedReviewPacketRead({ scope, run }),
      }),
    ),
});

export const ReadPatchFile = Command.define('ReadPatchFile', {
  args: {
    scope: Schema.String,
    run: Schema.Number,
    maxBytes: Schema.Number,
    file: Schema.instanceOf(File),
  },
  messages: [Message.SucceededPatchRead, Message.FailedPatchRead],
  execute: ({ scope, run, maxBytes, file }) =>
    Effect.gen(function* () {
      if (file.size > maxBytes)
        return yield* Effect.fail(new EditionArchiveTooLarge({ byteLimit: maxBytes }));
      const buffer = yield* Effect.tryPromise(() => file.arrayBuffer());
      if (buffer.byteLength > maxBytes)
        return yield* Effect.fail(new EditionArchiveTooLarge({ byteLimit: maxBytes }));
      return yield* Effect.try(() => new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    }).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededPatchRead({ scope, run, json }),
        onFailure: () => Message.FailedPatchRead({ scope, run }),
      }),
    ),
});

export const DownloadPatchArtifact = Command.define('DownloadPatchArtifact', {
  args: {
    scope: Schema.String,
    json: Schema.String,
    kind: Schema.Literals(['proposal', 'receipt']),
  },
  messages: [Message.CompletedPatchDownload, Message.FailedPatchDownload],
  execute: ({ scope, json, kind }) =>
    Effect.try(() => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download:
          kind === 'proposal' ? 'foldkit-zloz.patch.json' : 'foldkit-zloz.patch-receipt.json',
      });
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
      link.click();
    }).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedPatchDownload({ scope }),
        onFailure: () => Message.FailedPatchDownload({ scope }),
      }),
    ),
});

export const RenderPng = Command.define('RenderPng', {
  args: { payload: Schema.Unknown },
  interrupt: true,
  messages: [Message.ObservedPngReviewInput],
  execute: ({ payload: raw }) => {
    // SAFETY: the pure package review controller creates this detached typed payload.
    const payload = raw as ZlozPngRenderPayload;
    return Effect.tryPromise((signal) => renderPngExport(payload.input, { signal })).pipe(
      Effect.match({
        onSuccess: (result) =>
          Message.ObservedPngReviewInput({
            request: { ...payload, type: 'PngRenderSettled', result },
          }),
        onFailure: () =>
          Message.ObservedPngReviewInput({
            request: {
              ...payload,
              type: 'PngRenderSettled',
              result: {
                type: 'failed',
                code: 'render-failed',
                reason: 'PNG rendering failed. Review settings and retry.',
              } satisfies ZlozPngRenderResult,
            },
          }),
      }),
    );
  },
});
export const DownloadPng = Command.define('DownloadPng', {
  args: { artifact: Schema.Unknown, fileName: Schema.String },
  messages: [Message.CompletedPngDownload, Message.FailedPngDownload],
  execute: ({ artifact, fileName }) =>
    Effect.try(() =>
      downloadPngArtifact(
        /* SAFETY: the package review controller validates the trusted browser artifact. */ artifact as ZlozPngArtifact,
        fileName,
      ),
    ).pipe(
      Effect.match({
        onSuccess: () => Message.CompletedPngDownload(),
        onFailure: () => Message.FailedPngDownload(),
      }),
    ),
});

export const ReadAlchemyDescriptor = Command.define('ReadAlchemyDescriptor', {
  args: { run: Schema.Number, file: Schema.instanceOf(File) },
  messages: [Message.SucceededAlchemyRead, Message.FailedAlchemyRead],
  execute: ({ run, file }) =>
    Effect.gen(function* () {
      if (file.size > alchemyTextLimits.maxBytes)
        return yield* Effect.fail(
          new EditionArchiveTooLarge({ byteLimit: alchemyTextLimits.maxBytes }),
        );
      const buffer = yield* Effect.tryPromise(() =>
        file.slice(0, alchemyTextLimits.maxBytes + 1).arrayBuffer(),
      );
      if (buffer.byteLength > alchemyTextLimits.maxBytes)
        return yield* Effect.fail(
          new EditionArchiveTooLarge({ byteLimit: alchemyTextLimits.maxBytes }),
        );
      return yield* Effect.try(() => new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    }).pipe(
      Effect.match({
        onSuccess: (json) => Message.SucceededAlchemyRead({ run, json }),
        onFailure: () => Message.FailedAlchemyRead({ run }),
      }),
    ),
});

export const ArrangeAlchemyPreview = Command.define('ArrangeAlchemyPreview', {
  args: {
    id: Schema.Number,
    requestId: Schema.String,
    revision: Schema.Number,
    json: Schema.String,
    labels: Schema.String,
    headers: Schema.String,
    direction: Schema.Literals(['RIGHT', 'DOWN']),
  },
  messages: [Message.SucceededAlchemyLayout, Message.FailedAlchemyLayout],
  execute: ({ id, requestId, revision, json, labels, headers, direction }) =>
    Effect.tryPromise(async () => {
      // oxlint-disable-next-line linteffect/prevent-dynamic-imports -- ELK is loaded only after an explicit preview layout request; no SDK or providers are loaded.
      const { createElkLayout } = await import('@opsydyn/foldkit-zloz-elk');
      return createElkLayout({ direction, spacing: 160 })({
        requestId,
        revision,
        graph: parseGraph(json),
        groupHeaders: Schema.decodeUnknownSync(
          Schema.Array(
            Schema.Struct({
              id: Schema.String,
              size: Schema.Struct({ width: Schema.Number, height: Schema.Number }),
              padding: Schema.Struct({
                top: Schema.Number,
                right: Schema.Number,
                bottom: Schema.Number,
                left: Schema.Number,
              }),
              gap: Schema.Number,
            }),
          ),
        )(JSON.parse(headers)),
        edgeLabels: Schema.decodeUnknownSync(
          Schema.Array(
            Schema.Struct({
              id: Schema.String,
              size: Schema.Struct({ width: Schema.Number, height: Schema.Number }),
            }),
          ),
        )(JSON.parse(labels)),
      });
    }).pipe(
      Effect.match({
        onSuccess: (result) => Message.SucceededAlchemyLayout({ id, result }),
        onFailure: () => Message.FailedAlchemyLayout({ id, requestId }),
      }),
    ),
});
