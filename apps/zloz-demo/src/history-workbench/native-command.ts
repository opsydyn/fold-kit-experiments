import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';

import { Message } from './message';
export const nativeByteLimit = 1024 * 1024;
export const CreateNativeSession = Command.define('CreateNativeSession', {
  messages: [Message.SucceededNativeSession, Message.FailedNativeSession],
  execute: Effect.try(() => crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (id) => Message.SucceededNativeSession({ id }),
      onFailure: () => Message.FailedNativeSession(),
    }),
  ),
});
export const ReadNativeFile = Command.define('ReadNativeFile', {
  args: { token: Schema.Number, file: Schema.instanceOf(File) },
  interrupt: { keyFields: ['token'], toKey: ({ token }) => String(token) },
  messages: [Message.SucceededNativeRead, Message.FailedNativeRead],
  execute: ({ token, file }) =>
    Effect.gen(function* () {
      if (file.size > nativeByteLimit)
        return Message.FailedNativeRead({ token, reason: 'Artifact exceeds 1 MiB.' });
      const buffer = yield* Effect.tryPromise(() => file.arrayBuffer());
      if (buffer.byteLength > nativeByteLimit)
        return Message.FailedNativeRead({ token, reason: 'Artifact exceeds 1 MiB.' });
      const text = yield* Effect.try(() =>
        new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      );
      return Message.SucceededNativeRead({ token, text });
    }).pipe(
      Effect.match({
        onSuccess: (message) => message,
        onFailure: () =>
          Message.FailedNativeRead({
            token,
            reason: 'Could not read valid UTF-8. Previous review retained.',
          }),
      }),
    ),
});
export const DownloadNative = Command.define('DownloadNative', {
  args: { text: Schema.String, kind: Schema.Literals(['proposal', 'receipt', 'packet']) },
  messages: [Message.CompletedNativeDownload, Message.FailedNativeDownload],
  execute: ({ text, kind }) =>
    Effect.gen(function* () {
      const acquire = Effect.try(() =>
        URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      );
      const url = yield* Effect.acquireRelease(acquire, (url) =>
        Effect.sync(() => URL.revokeObjectURL(url)),
      );
      yield* Effect.try(() =>
        Object.assign(document.createElement('a'), {
          href: url,
          download: `zloz-${kind}-v2.json`,
        }).click(),
      );
      yield* Effect.sleep('1 second');
    }).pipe(
      Effect.scoped,
      Effect.match({
        onSuccess: () => Message.CompletedNativeDownload(),
        onFailure: () => Message.FailedNativeDownload(),
      }),
    ),
});
