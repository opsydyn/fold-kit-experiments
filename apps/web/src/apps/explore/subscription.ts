import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Stream } from 'effect';
import { Subscription } from 'foldkit';

import { HISTOGRAM, SCATTER } from './charts';
import { Message } from './message';
import type { Surface } from './message';
import type { Model } from './model';

/** Where a pointer event landed: which chart, and the plot pixel under it. */
interface PointerTarget {
  readonly surface: Surface;
  readonly x: number;
  readonly y: number;
}

/** The chart under a pointer event, and the drawing surface inside it to measure. */
const surfaceOf = (event: PointerEvent): PointerTarget => {
  const host = event.target instanceof Element ? event.target.closest('[data-explore]') : null;
  const name = host?.getAttribute('data-explore');
  const drawn = host?.querySelector('canvas, svg');
  if (
    host === null ||
    host === undefined ||
    drawn === null ||
    drawn === undefined ||
    (name !== 'scatter' && name !== 'histogram')
  )
    return { surface: 'outside', x: 0, y: 0 };
  const size = name === 'scatter' ? SCATTER : HISTOGRAM;
  const point = pointerToPlot(
    { x: event.clientX, y: event.clientY },
    drawn.getBoundingClientRect(),
    size,
  );
  return { surface: name, ...point };
};

/**
 * Pointer input for both charts. foldkit-viz installs no listeners, so the app
 * streams document pointer events and converts them to plot pixels here.
 */
const moves: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointermove',
).pipe(Stream.map((event) => Message.MovedPointer(surfaceOf(event))));
const presses: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointerdown',
).pipe(
  Stream.map((event) => {
    const { surface, x } = surfaceOf(event);
    return Message.PressedPointer({ surface, x });
  }),
);
const releases: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointerup',
).pipe(Stream.map(() => Message.ReleasedPointer()));

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  pointer: Subscription.persistentEntry(
    Stream.mergeAll([moves, presses, releases], { concurrency: 'unbounded' }),
  ),
}));
