/**
 * An inspector generated from schemas (roadmap, "Beyond parity" 4): the fields of any
 * value with a schema (a scene node, a material, a Model's own records) as an inspector
 * shows them, and edits that are checked by the same schema, so an inspector can never
 * put a value the schema rejects into a Model.
 *
 * `fields(schema, value)` lists them (numbers, text, switches, choices, colours, vectors,
 * and read-only kinds and lists); `edit(schema, value, path, next)` puts `next` at
 * `path` and decodes the result, failing with the schema's own account of what is
 * wrong. Colours are fields typed `SceneSchema.Rgb`; vectors, `SceneSchema.Vec3`.
 *
 * @module
 */
import { Result, Schema } from 'effect';

import {
  type FieldPath,
  type InspectableAst,
  type InspectedField,
  inspectFields,
  setAt,
} from '../kernel/inspect.ts';
import * as SceneSchema from './SceneSchema.ts';

const hints = { colours: [SceneSchema.Rgb.ast], vectors: [SceneSchema.Vec3.ast] };

/** The AST, read through the shapes the inspector understands. */
const inspectable = (schema: Schema.Top): InspectableAst => schema.ast;

/** The fields of `value`, as `schema` describes it, in the schema's order. */
export const fields = (schema: Schema.Top, value: unknown): ReadonlyArray<InspectedField> =>
  inspectFields(inspectable(schema), value, hints);

/** `value` with `next` at `path`, if `schema` accepts the result; why not, if it does not. */
export const edit = <A>(
  schema: Schema.Decoder<A>,
  value: A,
  path: FieldPath,
  next: unknown,
): Result.Result<A, string> =>
  Schema.decodeUnknownResult(schema)(setAt(value, path, next)).pipe(
    Result.mapError((error) => error.message),
  );
