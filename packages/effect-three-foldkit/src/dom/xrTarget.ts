/**
 * A mounted scene as an immersive session target: its frames handed to the session while
 * it presents, and the session's start and end dispatched as `scene-xr` events.
 *
 * @module
 */
import type { GatedFrames, Xr } from '@opsydyn/effect-three';

import type { Latch } from './latch.ts';
import type { XrMode, XrTarget } from './xrHub.ts';

/**
 * The page's frames for a scene: open while it is visible and no session presents it
 * (a session brings its own frames, as React Three Fiber's loop stands aside).
 */
export const createFrameGate = (frames: GatedFrames) => {
  let visible = true;
  let presenting = false;
  const apply = (): void => frames.setOpen(visible && !presenting);
  return {
    setVisible: (next: boolean): void => {
      visible = next;
      apply();
    },
    setPresenting: (next: boolean): void => {
      presenting = next;
      apply();
    },
  };
};

export type FrameGate = ReturnType<typeof createFrameGate>;

/** The `scene-xr` event: the mode presenting, or `null` when the session ended. */
export const dispatchXrSession = (element: Element, live: Latch, mode: XrMode | null): void => {
  if (live.isOpen()) element.dispatchEvent(new CustomEvent('scene-xr', { detail: { mode } }));
};

/** A scene as a target for the page's immersive sessions. */
export const xrTarget = (scene: {
  readonly element: Element;
  readonly canvas: HTMLCanvasElement;
  readonly live: Latch;
  readonly gate: FrameGate;
  readonly settings: () => Xr | null;
  readonly draw: () => void;
}): XrTarget => ({
  canvas: scene.canvas,
  settings: scene.settings,
  draw: scene.draw,
  presenting: (mode) => {
    scene.gate.setPresenting(mode !== null);
    // Back on the page's frames: draw once, as React Three Fiber invalidates on session end.
    if (mode === null) scene.draw();
    dispatchXrSession(scene.element, scene.live, mode);
  },
});
