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

/** The renderer backend could not be created (for example, no WebGL2 context). */
export class RendererUnavailable extends Data.TaggedError('RendererUnavailable')<{
  readonly cause: unknown;
}> {}
