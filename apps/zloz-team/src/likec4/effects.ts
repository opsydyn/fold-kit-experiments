import { Effect, Schema } from 'effect';

import { requestLimit } from './review';
import { Message, ReadFileArgs } from './state';

const ReadFile = Schema.Struct(ReadFileArgs);

// oxlint-disable-next-line linteffect/no-effect-wrapper-alias -- The native import island and the legacy canvas both invoke the same file command.
export function readFile({ file, epoch }: typeof ReadFile.Type) {
  if (!(file instanceof File) || file.size > requestLimit)
    return Effect.succeed(Message.SettledRead({ epoch, text: null }));
  return Effect.tryPromise(async () =>
    new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()),
  ).pipe(
    Effect.orElseSucceed(() => null),
    Effect.map((text) => Message.SettledRead({ epoch, text })),
  );
}
