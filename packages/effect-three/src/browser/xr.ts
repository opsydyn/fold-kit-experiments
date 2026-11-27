/**
 * Immersive sessions as Effects an application runs from Foldkit Commands: whether a mode
 * is supported, entering it from a user gesture, and leaving it. The scene presented is
 * the mounted one whose description has `xr`; while presenting, the session drives its
 * frames and the view's `onXRSession` reports the session starting and ending.
 *
 * @module
 */
import { Data, Effect } from 'effect';

import type { XrHub, XrMode } from './dom/xrHub.ts';

/** A session could not start: no WebXR, no scene describing `xr`, or the request refused. */
export class XrUnavailable extends Data.TaggedError('XrUnavailable')<{
  readonly mode: XrMode;
  readonly cause: unknown;
}> {}

/** The immersive session controls for an environment's hub. */
export const makeXr = (hub: XrHub) => ({
  /** Whether the browser can present `mode` (false without WebXR). */
  supported: (mode: XrMode) => Effect.promise(() => hub.supported(mode)),
  /**
   * Enters `mode`, presenting the mounted scene that describes `xr`. Run it from the
   * Command a click (or other user gesture) produces: browsers require one.
   */
  enter: (mode: XrMode) =>
    Effect.tryPromise({
      try: () => hub.enter(mode),
      catch: (cause) => new XrUnavailable({ mode, cause }),
    }),
  /** Ends the session, if there is one. */
  exit: Effect.promise(() => hub.exit()),
});

export type XrControls = ReturnType<typeof makeXr>;
