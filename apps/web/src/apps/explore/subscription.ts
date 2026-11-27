import { Mount } from '@effect/ui';
import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Stream } from 'effect';

import { HISTOGRAM, SCATTER } from './charts';
import { Message } from './message';
import type { Surface } from './message';

/** Where a pointer event landed: which chart, and the plot pixel under it. */
interface PointerTarget {
  readonly surface: Surface;
  readonly x: number;
  readonly y: number;
}

/** The chart under a pointer event, and the drawing surface inside it to measure. */
const surfaceOf = (root: HTMLElement, event: PointerEvent): PointerTarget => {
  const host = event.target instanceof Element ? event.target.closest('[data-explore]') : null;
  const name = host?.getAttribute('data-explore');
  const drawn = host?.querySelector('canvas, svg');
  if (
    host === null ||
    host === undefined ||
    !root.contains(host) ||
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

/** The island handles only its own surfaces, including release outside its bounds. */
export const TrackPointer = Mount.makeStream(
  'TrackExplorePointer',
  { args: {} },
  (root: HTMLElement) => {
    const document = root.ownerDocument;
    const moves: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
      document,
      'pointermove',
    ).pipe(Stream.map((event) => Message.MovedPointer(surfaceOf(root, event))));
    const presses: Stream.Stream<Message> = Stream.fromEventListener<PointerEvent>(
      root,
      'pointerdown',
    ).pipe(
      Stream.map((event) => {
        const { surface, x } = surfaceOf(root, event);
        return Message.PressedPointer({ surface, x });
      }),
    );
    const releases = Stream.fromEventListener<PointerEvent>(document, 'pointerup').pipe(
      Stream.map(() => Message.ReleasedPointer()),
    );
    const cancellations = Stream.fromEventListener<PointerEvent>(document, 'pointercancel').pipe(
      Stream.map(() => Message.ReleasedPointer()),
    );
    return Stream.mergeAll([moves, presses, releases, cancellations], { concurrency: 'unbounded' });
  },
);
