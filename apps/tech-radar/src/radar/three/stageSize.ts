/**
 * The stage's shape, as the radar's canvas has it: width over height, whenever it changes
 * size (a rotated phone, the sheet moving between stops, a resized window). The camera's
 * field of view and the label placement follow it, so a tall phone stage shows more of
 * the scene above and below instead of cropping its sides.
 */
import { Cause, Effect, Queue, Stream } from 'effect';

/** The canvas, once the radar has drawn it. */
const stageSelector = '.e3-stage-fill';

/** The canvas's size, in CSS pixels. */
export type StageSize = Readonly<{ width: number; height: number }>;

/** Watches the canvas's size, calling `emit` with it; returns how to stop. */
const watchStage = (emit: (size: StageSize) => void) => (): (() => void) => {
  const observer = new ResizeObserver((entries) =>
    entries
      .map(({ contentRect }) => contentRect)
      .filter(({ width, height }) => width > 0 && height > 0)
      .forEach(({ width, height }) => emit({ width, height })),
  );
  const waiting = { frame: 0 };
  const find = (): void => {
    const stage = globalThis.document.querySelector(stageSelector);
    if (stage === null) waiting.frame = globalThis.requestAnimationFrame(find);
    else observer.observe(stage);
  };
  find();
  return () => {
    globalThis.cancelAnimationFrame(waiting.frame);
    observer.disconnect();
  };
};

const connect = (queue: Queue.Queue<StageSize, Cause.Done>) => {
  const start = Effect.sync(watchStage((size) => Queue.offerUnsafe(queue, size)));
  return Effect.acquireRelease(start, Effect.sync);
};

/** The canvas's size, each time it changes. */
export const stageSizes = Stream.callback<StageSize>(connect).pipe(
  Stream.changesWith((a, b) => a.width === b.width && a.height === b.height),
);

/**
 * The camera's vertical field of view, in degrees, for a stage of this shape. A square or
 * wide stage keeps `fov`; a portrait one widens it so the radar keeps the width a square
 * stage shows, and the extra height shows more of the scene.
 */
export const fovFor = (fov: number, aspect: number): number =>
  aspect >= 1 ? fov : (2 * Math.atan(Math.tan((fov * Math.PI) / 360) / aspect) * 180) / Math.PI;
