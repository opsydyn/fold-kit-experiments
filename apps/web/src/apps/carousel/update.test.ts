import { describe, expect, it } from 'vitest';

import { Message } from './message';
import { Drag, Model } from './model';
import { update } from './update';

const slides = ['Adventure', 'Discovery', 'Journey'].map((title) => ({
  title,
  caption: '',
  bg: '',
}));
const loaded = Model.Loaded({ slides, activeIndex: 0, drag: Drag.Idle() });

describe('carousel update', () => {
  it('loads slides and wraps keyboard navigation in both directions', () => {
    const model = update(Model.Loading(), Message.LoadedSlides({ slides }));
    expect(model).toEqual(loaded);
    const last = update(model, Message.PressedNavigationKey({ key: 'ArrowLeft' }));
    expect(last).toMatchObject({ activeIndex: 2 });
    expect(update(last, Message.ClickedNext())).toMatchObject({ activeIndex: 0 });
  });

  it('settles a released drag one slide forward and stops requesting frames', () => {
    const pressed = update(loaded, Message.PressedSlide());
    const moved = update(pressed, Message.MovedDragPointer({ deltaX: -180 }));
    const released = update(
      moved,
      Message.ReleasedDragPointer({ deltaX: -180, velocityX: 0, trackWidth: 300 }),
    );
    expect(released).toMatchObject({
      activeIndex: 1,
      drag: { _tag: 'Settling', fromIndex: 0, targetIndex: 1, fromDeltaX: -180 },
    });
    expect(update(released, Message.TickedSettle({ deltaTimeMs: 500 }))).toMatchObject({
      activeIndex: 1,
      drag: Drag.Idle(),
    });
  });

  it('returns to the current slide after cancellation, ignoring the subsequent release', () => {
    const dragging = update(
      update(loaded, Message.PressedSlide()),
      Message.MovedDragPointer({ deltaX: -100 }),
    );
    const cancelled = update(dragging, Message.CancelledDrag());
    expect(cancelled).toMatchObject({
      activeIndex: 0,
      drag: { _tag: 'Settling', fromIndex: 0, targetIndex: 0, fromDeltaX: -100 },
    });
    expect(
      update(
        cancelled,
        Message.ReleasedDragPointer({ deltaX: -100, velocityX: 0, trackWidth: 300 }),
      ),
    ).toBe(cancelled);
  });
});
