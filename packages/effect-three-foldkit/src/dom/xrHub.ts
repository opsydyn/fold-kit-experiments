/**
 * The page's immersive sessions: which mounted scenes can be presented, and the one
 * session (WebXR allows one at a time) presenting a scene.
 *
 * @module
 */
import type { SelectInput, Xr } from '@opsydyn/effect-three';

import { webglRendererOf } from './webgl.ts';
import { type Presentation, present, sessionInit, type XrSystem } from './xr.ts';

/** The immersive session modes. */
export type XrMode = 'immersive-vr' | 'immersive-ar';

/** A mounted scene that can be presented. */
export type XrTarget = {
  readonly canvas: HTMLCanvasElement;
  /** The scene's current `xr` description; `null` while it does not ask to be presented. */
  readonly settings: () => Xr | null;
  /** Draws one frame now (the session calls it for each of its frames). */
  readonly draw: () => void;
  /** A controller's select, along its ray in the scene. */
  readonly select: (input: SelectInput) => void;
  /** The session began presenting this scene in `mode`, or (with `null`) ended. */
  readonly presenting: (mode: XrMode | null) => void;
};

export type XrHub = {
  /** Makes a scene presentable; returns a function that withdraws it (ending its session). */
  readonly register: (target: XrTarget) => () => void;
  readonly supported: (mode: XrMode) => Promise<boolean>;
  /**
   * Requests a session and presents the first registered scene that describes `xr`.
   * Call from a user gesture's handling: browsers require one to start a session.
   */
  readonly enter: (mode: XrMode) => Promise<void>;
  readonly exit: () => Promise<void>;
};

type Current = { readonly target: XrTarget; readonly presentation: Presentation };

/** Creates the hub for a page; `system` is `navigator.xr` when the browser has WebXR. */
export const createXrHub = (system: () => XrSystem | undefined): XrHub => {
  const targets = new Set<XrTarget>();
  let current: Current | undefined;

  const presentable = (): { readonly target: XrTarget; readonly settings: Xr } | undefined => {
    for (const target of targets) {
      const settings = target.settings();
      if (settings !== null) return { target, settings };
    }
    return undefined;
  };

  const enter = async (mode: XrMode): Promise<void> => {
    if (current !== undefined) return;
    const xr = system();
    if (xr === undefined) throw new Error('WebXR is not available in this browser');
    const chosen = presentable();
    if (chosen === undefined) throw new Error('no mounted scene describes xr');
    const renderer = webglRendererOf(chosen.target.canvas);
    if (renderer === undefined) throw new Error('the scene is not drawn with WebGL');
    const session = await xr.requestSession(mode, sessionInit(chosen.settings));
    const { target } = chosen;
    // Each frame: follow the description (a new origin moves the player), then draw.
    const draw = (): void => {
      const settings = target.settings();
      if (settings !== null) current?.presentation.update(settings);
      target.draw();
    };
    const ended = (): void => {
      current = undefined;
      target.presenting(null);
    };
    const presentation = await present(
      renderer,
      session,
      chosen.settings,
      draw,
      target.select,
      ended,
    );
    current = { target, presentation };
    target.presenting(mode);
  };

  return {
    register: (target) => {
      targets.add(target);
      return () => {
        targets.delete(target);
        if (current?.target === target) void current.presentation.session.end();
      };
    },
    supported: async (mode) => (await system()?.isSessionSupported(mode)) ?? false,
    enter,
    exit: async () => {
      await current?.presentation.session.end();
    },
  };
};
