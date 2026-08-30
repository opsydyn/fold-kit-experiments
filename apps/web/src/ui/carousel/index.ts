import { Effect, Match, Option, pipe, Schema, Stream } from 'effect';
import { Subscription } from 'foldkit';
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

// MODEL

type DragState =
  | { readonly _tag: 'Idle' }
  | {
      readonly _tag: 'Dragging';
      readonly originIndex: number;
      readonly startX: number;
      readonly deltaX: number;
      readonly velocityX: number;
      readonly lastTime: number;
    }
  | {
      readonly _tag: 'Settling';
      readonly fromIndex: number;
      readonly targetIndex: number;
      readonly fromDeltaX: number;
      readonly elapsed: number;
      readonly duration: number;
    };

export type Model = Readonly<{
  id: string;
  slideCount: number;
  activeIndex: number;
  loop: boolean;
  dragState: DragState;
}>;

// MESSAGE

export const Message = defineMessageUnion({
  PressedSlide: { clientX: Schema.Number, timestamp: Schema.Number },
  MovedDragPointer: {
    deltaX: Schema.Number,
    velocityX: Schema.Number,
  },
  ReleasedDragPointer: {
    deltaX: Schema.Number,
    velocityX: Schema.Number,
    trackWidth: Schema.Number,
  },
  CancelledDrag: {},
  TickedSettle: { deltaTimeMs: Schema.Number },
  ClickedPrev: {},
  ClickedNext: {},
  ClickedDot: { index: Schema.Number },
  PressedKeyboardNavigation: {
    direction: Schema.String,
  },
});
export type Message = typeof Message.Type;

// OUT MESSAGE

export const OutMessage = defineMessageUnion({
  ChangedSlide: { index: Schema.Number },
});
export type OutMessage = typeof OutMessage.Type;

// INIT

export type InitConfig = Readonly<{
  id: string;
  slideCount: number;
  initialIndex?: number;
  loop?: boolean;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  slideCount: config.slideCount,
  activeIndex: Math.max(0, Math.min(config.initialIndex ?? 0, config.slideCount - 1)),
  loop: config.loop ?? false,
  dragState: { _tag: 'Idle' },
});

// HELPERS

const DRAG_THRESHOLD = 0.25;
const VELOCITY_THRESHOLD_PX_MS = 0.2;
const MOMENTUM_DECAY_MS = 120;
const BASE_SETTLE_MS = 280;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

const clampOrLoop = (index: number, slideCount: number, loop: boolean): number => {
  if (loop) {
    return ((index % slideCount) + slideCount) % slideCount;
  }
  return Math.max(0, Math.min(index, slideCount - 1));
};

const computeTargetIndex = (
  originIndex: number,
  deltaX: number,
  velocityX: number,
  trackWidth: number,
  slideCount: number,
  loop: boolean,
): number => {
  const momentumDelta = velocityX * MOMENTUM_DECAY_MS;
  const totalDelta = deltaX + momentumDelta;
  const fraction = totalDelta / trackWidth;
  const shouldSnap =
    Math.abs(fraction) >= DRAG_THRESHOLD || Math.abs(velocityX) >= VELOCITY_THRESHOLD_PX_MS;
  const raw = shouldSnap ? originIndex - Math.round(fraction) : originIndex;
  return clampOrLoop(raw, slideCount, loop);
};

const computeSettleDuration = (from: number, to: number): number =>
  BASE_SETTLE_MS + Math.abs(to - from) * 60;

const currentTransform = (model: Model): string => {
  const { dragState } = model;
  if (dragState._tag === 'Idle') {
    return `translateX(-${model.activeIndex * 100}%)`;
  }
  if (dragState._tag === 'Dragging') {
    const { originIndex, deltaX } = dragState;
    return `translateX(calc(-${originIndex * 100}% + ${deltaX}px))`;
  }
  const { fromIndex, targetIndex, fromDeltaX, elapsed, duration } = dragState;
  const progress = easeOutCubic(Math.min(elapsed / Math.max(duration, 1), 1));
  const indexFraction = fromIndex + (targetIndex - fromIndex) * progress;
  const pixelOffset = fromDeltaX * (1 - progress);
  if (pixelOffset === 0) {
    return `translateX(-${indexFraction * 100}%)`;
  }
  return `translateX(calc(-${indexFraction * 100}% + ${pixelOffset}px))`;
};

// UPDATE

type Return = readonly [Model, readonly [], Option.Option<OutMessage>];

const withChanged = (
  model: Model,
  targetIndex: number,
): readonly [Model, readonly [], Option.Option<OutMessage>] => {
  const maybeOut =
    targetIndex !== model.activeIndex
      ? Option.some(OutMessage.ChangedSlide({ index: targetIndex }))
      : Option.none();
  return [model, [], maybeOut];
};

const navigateTo = (model: Model, targetIndex: number): Return => {
  if (targetIndex === model.activeIndex) {
    return [model, [], Option.none()];
  }
  return [
    {
      ...model,
      activeIndex: targetIndex,
      dragState: {
        _tag: 'Settling',
        fromIndex: model.activeIndex,
        targetIndex,
        fromDeltaX: 0,
        elapsed: 0,
        duration: computeSettleDuration(model.activeIndex, targetIndex),
      },
    },
    [],
    Option.some(OutMessage.ChangedSlide({ index: targetIndex })),
  ];
};

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      PressedSlide: ({ clientX, timestamp }) => {
        if (model.dragState._tag === 'Dragging') {
          return [model, [], Option.none()];
        }
        return [
          {
            ...model,
            dragState: {
              _tag: 'Dragging',
              originIndex: model.activeIndex,
              startX: clientX,
              deltaX: 0,
              velocityX: 0,
              lastTime: timestamp,
            },
          },
          [],
          Option.none(),
        ];
      },

      MovedDragPointer: ({ deltaX, velocityX }) => {
        if (model.dragState._tag !== 'Dragging') {
          return [model, [], Option.none()];
        }
        return [
          { ...model, dragState: { ...model.dragState, deltaX, velocityX } },
          [],
          Option.none(),
        ];
      },

      ReleasedDragPointer: ({ deltaX, velocityX, trackWidth }) => {
        if (model.dragState._tag !== 'Dragging') {
          return [model, [], Option.none()];
        }
        const { originIndex } = model.dragState;
        const targetIndex = computeTargetIndex(
          originIndex,
          deltaX,
          velocityX,
          trackWidth,
          model.slideCount,
          model.loop,
        );
        const [modelWithIndex, , maybeOut] = withChanged(
          { ...model, activeIndex: targetIndex },
          targetIndex,
        );
        return [
          {
            ...modelWithIndex,
            activeIndex: targetIndex,
            dragState: {
              _tag: 'Settling',
              fromIndex: originIndex,
              targetIndex,
              fromDeltaX: deltaX,
              elapsed: 0,
              duration: computeSettleDuration(originIndex, targetIndex),
            },
          },
          [],
          maybeOut,
        ];
      },

      CancelledDrag: () => {
        if (model.dragState._tag !== 'Dragging') {
          return [model, [], Option.none()];
        }
        const { originIndex, deltaX } = model.dragState;
        return [
          {
            ...model,
            dragState: {
              _tag: 'Settling',
              fromIndex: originIndex,
              targetIndex: originIndex,
              fromDeltaX: deltaX,
              elapsed: 0,
              duration: 200,
            },
          },
          [],
          Option.none(),
        ];
      },

      TickedSettle: ({ deltaTimeMs }) => {
        if (model.dragState._tag !== 'Settling') {
          return [model, [], Option.none()];
        }
        const { elapsed, duration } = model.dragState;
        const newElapsed = elapsed + deltaTimeMs;
        if (newElapsed >= duration) {
          return [{ ...model, dragState: { _tag: 'Idle' } }, [], Option.none()];
        }
        return [
          { ...model, dragState: { ...model.dragState, elapsed: newElapsed } },
          [],
          Option.none(),
        ];
      },

      ClickedPrev: () =>
        navigateTo(model, clampOrLoop(model.activeIndex - 1, model.slideCount, model.loop)),

      ClickedNext: () =>
        navigateTo(model, clampOrLoop(model.activeIndex + 1, model.slideCount, model.loop)),

      ClickedDot: ({ index }) => navigateTo(model, index),

      PressedKeyboardNavigation: ({ direction }) =>
        navigateTo(
          model,
          clampOrLoop(
            model.activeIndex + (direction === 'Next' ? 1 : -1),
            model.slideCount,
            model.loop,
          ),
        ),
    }),
  );

// SUBSCRIPTION

const DragActivity = Schema.Union([
  Schema.Literal('Idle'),
  Schema.Literal('Active'),
  Schema.Literal('Settling'),
]);

const dragActivityFromModel = (model: Model): 'Idle' | 'Active' | 'Settling' => {
  if (model.dragState._tag === 'Dragging') {
    return 'Active';
  }
  if (model.dragState._tag === 'Settling') {
    return 'Settling';
  }
  return 'Idle';
};

const trackById = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-carousel-track-id="${id}"]`);

const documentDragStyles: Stream.Stream<never> = Stream.callback(() => {
  const setup = Effect.sync(() => {
    document.documentElement.style.setProperty('user-select', 'none');
    document.documentElement.style.setProperty('-webkit-user-select', 'none');
    const style = document.createElement('style');
    style.textContent = '* { cursor: grabbing !important; }';
    document.head.appendChild(style);
    return style;
  });
  return Effect.acquireRelease(setup, (style) =>
    Effect.sync(() => {
      document.documentElement.style.removeProperty('user-select');
      document.documentElement.style.removeProperty('-webkit-user-select');
      style.remove();
    }),
  ).pipe(
    Effect.flatMap(() => {
      // FoldKit subscription — acquireRelease above handles teardown; Effect.never holds the scope
      // open for the subscription's lifetime (this is the canonical Stream.callback pattern).
      // oxlint-disable-next-line linteffect/no-effect-never
      return Effect.never;
    }),
  );
});

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  dragPointer: entry(
    { dragActivity: DragActivity, id: Schema.String, startX: Schema.Number },
    {
      modelToDependencies: (model) => ({
        dragActivity: dragActivityFromModel(model),
        id: model.id,
        startX: model.dragState._tag === 'Dragging' ? model.dragState.startX : 0,
      }),
      dependenciesToStream: ({ dragActivity, id, startX }) => {
        let lastVelocityX = 0;
        let lastClientX = startX;
        let lastTime = performance.now();

        const pointerEvents = Stream.merge(
          Stream.fromEventListener<PointerEvent>(document, 'pointermove').pipe(
            Stream.map((event) => {
              const now = performance.now();
              const dt = Math.max(now - lastTime, 1);
              lastVelocityX = (event.clientX - lastClientX) / dt;
              lastClientX = event.clientX;
              lastTime = now;
              return Message.MovedDragPointer({
                deltaX: event.clientX - startX,
                velocityX: lastVelocityX,
              });
            }),
          ),
          Stream.fromEventListener<PointerEvent>(document, 'pointerup').pipe(
            Stream.mapEffect((event) =>
              Effect.sync(() => {
                const el = trackById(id);
                const trackWidth = el ? el.getBoundingClientRect().width : 300;
                return Option.some(
                  Message.ReleasedDragPointer({
                    deltaX: event.clientX - startX,
                    velocityX: lastVelocityX,
                    trackWidth,
                  }),
                );
              }),
            ),
            Stream.filter(Option.isSome),
            Stream.map((o) => o.value),
          ),
        );

        return Stream.when(
          Stream.merge(pointerEvents, documentDragStyles),
          Effect.sync(() => dragActivity === 'Active'),
        );
      },
    },
  ),

  dragEscape: entry(
    { dragActivity: DragActivity },
    {
      modelToDependencies: (model) => ({ dragActivity: dragActivityFromModel(model) }),
      dependenciesToStream: ({ dragActivity }) =>
        Stream.when(
          Stream.fromEventListener<KeyboardEvent>(document, 'keydown').pipe(
            Stream.filter(({ key }) => key === 'Escape'),
            Stream.map(() => Message.CancelledDrag()),
          ),
          Effect.sync(() => dragActivity === 'Active'),
        ),
    },
  ),

  settle: Subscription.animationFrame({
    isActive: (model) => model.dragState._tag === 'Settling',
    toMessage: (deltaTimeMs) => Message.TickedSettle({ deltaTimeMs }),
  }),
}));

// VIEW

const LEFT_MOUSE_BUTTON = 0;

export type CarouselAttributes<M> = Readonly<{
  root: ReadonlyArray<Attribute<M>>;
  track: ReadonlyArray<Attribute<M>>;
  slideContainer: ReadonlyArray<Attribute<M>>;
  slide: (index: number) => ReadonlyArray<Attribute<M>>;
  prevButton: ReadonlyArray<Attribute<M>>;
  nextButton: ReadonlyArray<Attribute<M>>;
  dot: (index: number) => ReadonlyArray<Attribute<M>>;
}>;

export type ViewConfig<M> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => M;
  toView: (attrs: CarouselAttributes<M>) => Html;
  ariaLabel?: string;
}>;

export const view = <M>(config: ViewConfig<M>, h: HtmlBuilder<M>): Html => {
  const { model, toParentMessage, ariaLabel } = config;
  const isDragging = model.dragState._tag === 'Dragging';

  const handleKeyDown = (key: string): Option.Option<M> => {
    if (key === 'ArrowLeft') {
      return Option.some(toParentMessage(Message.PressedKeyboardNavigation({ direction: 'Prev' })));
    }
    if (key === 'ArrowRight') {
      return Option.some(toParentMessage(Message.PressedKeyboardNavigation({ direction: 'Next' })));
    }
    return Option.none();
  };

  const slidePointerHandler = (
    _pointerType: string,
    button: number,
    _screenX: number,
    _screenY: number,
    timeStamp: number,
    clientX: number,
  ): Option.Option<M> =>
    pipe(
      button,
      Option.liftPredicate((b) => b === LEFT_MOUSE_BUTTON),
      Option.map(() => toParentMessage(Message.PressedSlide({ clientX, timestamp: timeStamp }))),
    );

  const rootAttributes: ReadonlyArray<Attribute<M>> = [
    h.DataAttribute('carousel-id', model.id),
    h.Role('region'),
    h.AriaLabel(ariaLabel ?? 'Carousel'),
    h.Tabindex(0),
    h.OnKeyDownPreventDefault(handleKeyDown),
    h.Style({ outline: 'none' }),
  ];

  const trackAttributes: ReadonlyArray<Attribute<M>> = [
    h.DataAttribute('carousel-track-id', model.id),
    h.Style({ overflow: 'hidden', 'touch-action': 'pan-y' }),
  ];

  const slideContainerAttributes: ReadonlyArray<Attribute<M>> = [
    h.Style({
      display: 'flex',
      transform: currentTransform(model),
      'will-change': 'transform',
      'user-select': isDragging ? 'none' : 'auto',
      cursor: isDragging ? 'grabbing' : 'grab',
    }),
    h.OnPointerDown(slidePointerHandler),
  ];

  const slide = (index: number): ReadonlyArray<Attribute<M>> => [
    h.DataAttribute('carousel-slide', String(index)),
    h.Role('group'),
    h.AriaRoleDescription('slide'),
    h.AriaLabel(`${index + 1} of ${model.slideCount}`),
    ...(index !== model.activeIndex ? [h.AriaHidden(true)] : []),
    h.Style({ flex: '0 0 100%', 'min-width': '0' }),
  ];

  const prevButton: ReadonlyArray<Attribute<M>> = [
    h.OnClick(toParentMessage(Message.ClickedPrev())),
    h.AriaLabel('Previous slide'),
    ...(model.loop || model.activeIndex > 0 ? [] : [h.AriaDisabled(true)]),
  ];

  const nextButton: ReadonlyArray<Attribute<M>> = [
    h.OnClick(toParentMessage(Message.ClickedNext())),
    h.AriaLabel('Next slide'),
    ...(model.loop || model.activeIndex < model.slideCount - 1 ? [] : [h.AriaDisabled(true)]),
  ];

  const dot = (index: number): ReadonlyArray<Attribute<M>> => [
    h.OnClick(toParentMessage(Message.ClickedDot({ index }))),
    h.AriaLabel(`Go to slide ${index + 1}`),
    h.AriaPressed(index === model.activeIndex ? 'true' : 'false'),
    ...(index === model.activeIndex ? [h.DataAttribute('active', '')] : []),
  ];

  return config.toView({
    root: rootAttributes,
    track: trackAttributes,
    slideContainer: slideContainerAttributes,
    slide,
    prevButton,
    nextButton,
    dot,
  });
};
