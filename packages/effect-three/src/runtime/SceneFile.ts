/**
 * Scenes saved and loaded as JSON (roadmap, "Beyond parity" 4): a description in a
 * small versioned envelope, written and read through `SceneSchema`, so a file is either
 * a well-typed description or a typed failure saying where it is not. Fields added since
 * a file was written decode at their defaults, as stored descriptions always have.
 *
 * Decoding checks shapes, not the scene's own rules: duplicate keys and unknown
 * behaviours are rejected whole when the scene is applied (`InvalidScene`), against the
 * behaviours the app has registered.
 *
 * @module
 */
import { Result, Schema } from 'effect';

import type { SceneDescription } from '../kernel/index.ts';
import { UnreadableScene } from './errors.ts';
import * as SceneSchema from './SceneSchema.ts';

/**
 * A saved scene: what it is (`format`), the envelope's `version` (a later one decodes
 * older files, migrating them), and the description.
 */
export const SceneFile = Schema.Struct({
  format: Schema.Literal('effect-three/scene'),
  version: Schema.Literal(1),
  scene: SceneSchema.SceneDescription,
});
export type SceneFile = typeof SceneFile.Type;

const asJson = Schema.fromJsonString(SceneFile, { space: 2 });

/** The scene as the text of a scene file, indented for reading and diffing. */
export const save = (scene: SceneDescription): string =>
  Schema.encodeSync(asJson)(SceneFile.make({ format: 'effect-three/scene', version: 1, scene }));

const unreadable = (error: Schema.SchemaError) => new UnreadableScene({ issue: error.message });

/**
 * The scene a file's text describes, or why it cannot be read: a `Result`, which an
 * Effect can `yield*` directly.
 */
export const read = (text: string): Result.Result<SceneDescription, UnreadableScene> =>
  Schema.decodeUnknownResult(asJson)(text).pipe(
    Result.map((file) => file.scene),
    Result.mapError(unreadable),
  );
