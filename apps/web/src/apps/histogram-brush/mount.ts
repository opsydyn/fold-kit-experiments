import { Mount } from '@effect/ui';
import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Stream } from 'effect';

import { HISTOGRAM } from './charts';
import { Message, type Surface } from './message';

interface PointerTarget {
  readonly surface: Surface;
  readonly x: number;
}

function targetOf(root: HTMLElement, event: PointerEvent): PointerTarget {
  if (!(event.target instanceof Node) || !root.contains(event.target))
    return { surface: 'outside', x: 0 };
  const drawn = root.querySelector('svg');
  if (drawn === null) return { surface: 'outside', x: 0 };
  const { x } = pointerToPlot(
    { x: event.clientX, y: event.clientY },
    drawn.getBoundingClientRect(),
    HISTOGRAM,
  );
  return { surface: 'histogram', x };
}

/** The histogram owns its input. A release outside the island still ends the drag. */
export const TrackPointer = Mount.makeStream(
  'TrackHistogramPointer',
  { args: {} },
  (root: HTMLElement): Stream.Stream<Message> => {
    const document = root.ownerDocument;
    const moves = Stream.fromEventListener<PointerEvent>(root, 'pointermove').pipe(
      Stream.map((event) => Message.MovedPointer(targetOf(root, event))),
    );
    const presses = Stream.fromEventListener<PointerEvent>(root, 'pointerdown').pipe(
      Stream.map((event) => Message.PressedPointer(targetOf(root, event))),
    );
    const releases = Stream.fromEventListener<PointerEvent>(document, 'pointerup').pipe(
      Stream.map(() => Message.ReleasedPointer()),
    );
    const cancellations = Stream.fromEventListener<PointerEvent>(document, 'pointercancel').pipe(
      Stream.map(() => Message.ReleasedPointer()),
    );
    return Stream.mergeAll<Message, never, never>([moves, presses, releases, cancellations], {
      concurrency: 'unbounded',
    });
  },
);
