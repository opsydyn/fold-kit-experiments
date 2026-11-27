import { Command } from '@effect/ui';
import { parseEditionsV2, parseModelDocumentV2, ZlozError } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';

import { Message } from './message';
export const byteLimit = 5 * 1024 * 1024;
export const ReadHistoryFile = Command.make(
  'ReadHistoryFile',
  {
    args: {
      token: Schema.Number,
      kind: Schema.Literals(['model', 'archive']),
      file: Schema.instanceOf(File),
    },
    group: ['token'],
  },
  ({ token, kind, file }) =>
    Effect.gen(function* () {
      if (file.size > byteLimit)
        return yield* Effect.fail(new ZlozError('invalid-edit', 'File exceeds the 5 MiB limit.'));
      const buffer = yield* Effect.tryPromise(() => file.arrayBuffer());
      if (buffer.byteLength > byteLimit)
        return yield* Effect.fail(new ZlozError('invalid-edit', 'File exceeds the 5 MiB limit.'));
      const text = yield* Effect.try(() =>
        new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      );
      return yield* Effect.try(() =>
        kind === 'model'
          ? Message.SucceededModelRead({ token, document: parseModelDocumentV2(text) })
          : Message.SucceededArchiveRead({ token, editions: parseEditionsV2(text) }),
      );
    }).pipe(
      Effect.match({
        onSuccess: (message) => message,
        onFailure: () => Message.FailedRead({ token }),
      }),
    ),
);
export const DownloadHistory = Command.make(
  'DownloadHistory',
  {
    args: { json: Schema.String, kind: Schema.Literals(['model', 'archive']) },
  },
  ({ json, kind }) =>
    Effect.gen(function* () {
      const acquire = Effect.try(() =>
        URL.createObjectURL(new Blob([json], { type: 'application/json' })),
      );
      const url = yield* Effect.acquireRelease(acquire, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.try(() => {
        const link = Object.assign(document.createElement('a'), {
          href: url,
          download: kind === 'model' ? 'zloz-model-v2.json' : 'zloz-editions-v2.json',
        });
        link.click();
      });
      yield* Effect.sleep('1 second');
    }).pipe(
      Effect.scoped,
      Effect.match({
        onSuccess: () => Message.CompletedDownload(),
        onFailure: () => Message.FailedDownload(),
      }),
    ),
);
