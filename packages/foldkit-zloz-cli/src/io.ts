import { Buffer } from 'node:buffer';

import {
  parseModelDocument,
  parseSnapshot,
  type ZlozModelDocument,
  type JsonValue,
  type ZlozSnapshot,
} from '@opsydyn/foldkit-zloz';
import { Effect, FileSystem, Match, Schema, Stdio, Stream } from 'effect';
import type { PlatformError } from 'effect/PlatformError';

import { CliInputError, CliOutputError, encodeResponse, type CliResponse } from './protocol';

/** Hard UTF-8 byte limit shared by file and stdin input. */
export const inputByteLimit = 1_048_576;
const selectSource = (fs: FileSystem.FileSystem, stdio: Stdio.Stdio, input: string) =>
  Match.value(input).pipe(
    Match.when('-', () => stdio.stdin),
    Match.orElse((file) => fs.stream(file, { bytesToRead: inputByteLimit + 1, chunkSize: 16_384 })),
  );
const countChunk = (input: string) => (size: number, chunk: Uint8Array) =>
  Effect.succeed(size + chunk.byteLength).pipe(
    Effect.filterOrFail(
      (total) => total <= inputByteLimit,
      () =>
        new CliInputError({
          code: 'input-limit',
          message: `Input exceeds ${inputByteLimit} UTF-8 bytes.`,
          dimension: 'io',
          subject: input,
        }),
    ),
    Effect.map((total) => [total, [chunk]] as const),
  );
function collectInput(source: Stream.Stream<Uint8Array, PlatformError>, input: string) {
  return source.pipe(
    Stream.mapError(
      () =>
        new CliInputError({
          code: 'input-unavailable',
          message: 'Cannot read the input document.',
          dimension: 'io',
          subject: input,
        }),
    ),
    Stream.mapAccumEffect(() => 0, countChunk(input)),
    Stream.runCollect,
  );
}
const decodeUtf8 = (chunks: readonly Uint8Array[], input: string) =>
  Effect.try({
    try: () => new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
    catch: () =>
      new CliInputError({
        code: 'invalid-utf8',
        message: 'Input must be valid UTF-8.',
        dimension: 'syntax',
        subject: input,
      }),
  });
function decodeJson(text: string, input: string) {
  return Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json))(text).pipe(
    Effect.mapError(
      () =>
        new CliInputError({
          code: 'invalid-json',
          message: 'Input must be valid JSON.',
          dimension: 'syntax',
          subject: input,
        }),
    ),
  );
}
export type CliDocument =
  | Readonly<{ kind: 'snapshot'; snapshot: ZlozSnapshot }>
  | Readonly<{ kind: 'model'; document: ZlozModelDocument }>;
const modelMarker = Schema.Struct({ format: Schema.Literal('foldkit-zloz-model') });
const parseCliDocument = (text: string, model: boolean): CliDocument =>
  Match.value(model).pipe(
    Match.when(true, () => ({ kind: 'model' as const, document: parseModelDocument(text) })),
    Match.orElse(() => ({ kind: 'snapshot' as const, snapshot: parseSnapshot(text) })),
  );
const decodeDocument = (text: string, value: JsonValue, input: string) =>
  Effect.try({
    try: () => parseCliDocument(text, Schema.is(modelMarker)(value)),
    catch: (cause) =>
      new CliInputError({
        code: 'invalid-document',
        message: String(cause),
        dimension: 'semantics',
        subject: input,
      }),
  });
/** Scoped platform input; the core codec remains the authority for graph/snapshot semantics. */
export function readDocument(input: string) {
  const reading = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const stdio = yield* Stdio.Stdio;
    const terminal = yield* stdio.stdinIsTerminal;
    const source = yield* Effect.succeed(selectSource(fs, stdio, input)).pipe(
      Effect.filterOrFail(
        () => input !== '-' || !terminal,
        () =>
          new CliInputError({
            code: 'input-required',
            message: 'Pipe a Zloz document to stdin or use --input <file>.',
            dimension: 'io',
            subject: input,
          }),
      ),
    );
    const chunks = yield* collectInput(source, input);
    const text = yield* decodeUtf8(chunks, input);
    const value = yield* decodeJson(text, input);
    return yield* decodeDocument(text, value, input);
  });
  return reading.pipe(Effect.withSpan('zloz.cli.readDocument'));
}
/** Graph-only compatibility seam: never implicitly projects a model document. */
export function readGraph(input: string) {
  return readDocument(input).pipe(
    Effect.filterOrFail(
      (document): document is Extract<CliDocument, { kind: 'snapshot' }> =>
        document.kind === 'snapshot',
      () =>
        new CliInputError({
          code: 'model-projection-required',
          message:
            'Use readDocument for model identity and lineage; graph-only projection must be explicit.',
          dimension: 'identity',
          subject: input,
        }),
    ),
    Effect.map((document) => document.snapshot.graph),
  );
}
export function writeResponse(response: CliResponse) {
  return Effect.gen(function* () {
    const stdio = yield* Stdio.Stdio;
    const output = Stream.succeed(encodeResponse(response) + '\n');
    yield* output.pipe(
      Stream.run(stdio.stdout({ endOnDone: false })),
      Effect.mapError(() => new CliOutputError()),
    );
    return response;
  });
}
