/**
 * Typed failures of the scene runtime.
 *
 * @module
 */
import { Data } from 'effect';

import type { DescriptionError } from '../kernel/index.ts';

/** A scene description was rejected. Nothing was applied. */
export class InvalidScene extends Data.TaggedError('InvalidScene')<{
  readonly error: DescriptionError;
}> {}

/** A scene file could not be read: not JSON, not a scene file, or not a scene. */
export class UnreadableScene extends Data.TaggedError('UnreadableScene')<{
  /** Where and why, as the schema reports it. */
  readonly issue: string;
}> {}

/** The renderer backend could not be created (for example, no WebGL2 context). */
export class RendererUnavailable extends Data.TaggedError('RendererUnavailable')<{
  readonly cause: unknown;
}> {}
