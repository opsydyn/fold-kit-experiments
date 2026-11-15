import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Stream } from 'effect';
import { Subscription } from 'foldkit';

import { HISTOGRAM } from './charts';
import { Message } from './message';
import type { Surface } from './message';
import type { Model } from './model';

/** Where a pointer event landed: on the histogram or not, and its plot pixel across. */
interface PointerTarget {
  readonly surface: Surface;
  readonly x: number;
}

const targetOf = (event: PointerEvent): PointerTarget => {
  const host =
    event.target instanceof Element ? event.target.closest('[data-brush="histogram"]') : null;
  const drawn = host?.querySelector('svg');
  if (drawn === null || drawn === undefined) return { surface: 'outside', x: 0 };
  const { x } = pointerToPlot(
    { x: event.clientX, y: event.clientY },
    drawn.getBoundingClientRect(),
    HISTOGRAM,
  );
  return { surface: 'histogram', x };
};

/**
 * Pointer input for the histogram brush. foldkit-viz installs no listeners, so
 * the app streams document pointer events and converts them to plot pixels.
 */
const moves: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointermove',
).pipe(Stream.map((event) => Message.MovedPointer(targetOf(event))));
const presses: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointerdown',
).pipe(Stream.map((event) => Message.PressedPointer(targetOf(event))));
const releases: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
  document,
  'pointerup',
).pipe(Stream.map(() => Message.ReleasedPointer()));

export const subscriptions = Subscription.make<Model, Message>()((_entry) => ({
  pointer: Subscription.persistentEntry(
    Stream.mergeAll([moves, presses, releases], { concurrency: 'unbounded' }),
  ),
}));
