import { Message } from './message';
import { Drag, Model, type Loaded } from './model';

const settle = (fromIndex: number, targetIndex: number, fromDeltaX: number, duration: number) =>
  Drag.Settling({ fromIndex, targetIndex, fromDeltaX, elapsed: 0, duration });

const settleDuration = (from: number, to: number) => 280 + Math.abs(to - from) * 60;

const loopIndex = (index: number, count: number) => ((index % count) + count) % count;

function navigate(model: Loaded, index: number): Loaded {
  if (index === model.activeIndex || index < 0 || index >= model.slides.length) return model;
  return {
    ...model,
    activeIndex: index,
    drag: settle(model.activeIndex, index, 0, settleDuration(model.activeIndex, index)),
  };
}

function move(model: Loaded, step: number) {
  return navigate(model, loopIndex(model.activeIndex + step, model.slides.length));
}

export function update(model: Model, message: Message): Model {
  if (message._tag === 'LoadedSlides') {
    return Model.Loaded({ slides: message.slides, activeIndex: 0, drag: Drag.Idle() });
  }
  if (model._tag !== 'Loaded' || model.slides.length === 0) return model;
  const { drag } = model;
  return Message.match(message, {
    LoadedSlides: () => model,
    PressedSlide: () => ({
      ...model,
      drag: Drag.Dragging({ originIndex: model.activeIndex, deltaX: 0 }),
    }),
    MovedDragPointer: ({ deltaX }) =>
      drag._tag === 'Dragging' ? { ...model, drag: { ...drag, deltaX } } : model,
    ReleasedDragPointer: ({ deltaX, velocityX, trackWidth }) => {
      if (drag._tag !== 'Dragging') return model;
      const { originIndex } = drag;
      const fraction = trackWidth > 0 ? (deltaX + velocityX * 120) / trackWidth : 0;
      const steps =
        Math.abs(fraction) >= 0.25 || Math.abs(velocityX) >= 0.2 ? Math.round(fraction) : 0;
      const target = loopIndex(originIndex - steps, model.slides.length);
      return {
        ...model,
        activeIndex: target,
        drag: settle(originIndex, target, deltaX, settleDuration(originIndex, target)),
      };
    },
    CancelledDrag: () =>
      drag._tag === 'Dragging'
        ? { ...model, drag: settle(drag.originIndex, drag.originIndex, drag.deltaX, 200) }
        : model,
    TickedSettle: ({ deltaTimeMs }) => {
      if (drag._tag !== 'Settling') return model;
      const elapsed = drag.elapsed + deltaTimeMs;
      return { ...model, drag: elapsed >= drag.duration ? Drag.Idle() : { ...drag, elapsed } };
    },
    ClickedPrevious: () => move(model, -1),
    ClickedNext: () => move(model, 1),
    ClickedDot: ({ index }) => navigate(model, index),
    PressedNavigationKey: ({ key }) => move(model, key === 'ArrowRight' ? 1 : -1),
  });
}
