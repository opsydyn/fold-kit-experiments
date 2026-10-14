import { Match, Option } from 'effect';
import type { Return } from 'foldkit/update';

import type { Earthquake } from './data';
import { Message } from './message';
import { Gesture, initModel, type Model } from './model';

type Direction = Extract<Message, { _tag: 'ClickedTurn' }>['direction'];
const idle = () => Gesture.Idle({ ignoreNextMarkerClick: false });
const centerAt = (longitude: number, latitude: number): Model['center'] => [
  ((((longitude + 180) % 360) + 360) % 360) - 180,
  Math.max(-90, Math.min(90, latitude)),
];
function turn(model: Model, direction: Direction): Model {
  const offsets = {
    east: [15, 0],
    west: [-15, 0],
    north: [0, 15],
    south: [0, -15],
  } as const satisfies Record<Direction, readonly [number, number]>;
  const [longitude, latitude] = offsets[direction];
  return {
    ...model,
    center: centerAt(model.center[0] + longitude, model.center[1] + latitude),
    gesture: idle(),
  };
}
function zoom(model: Model, factor: number): Model {
  return { ...model, zoom: Math.max(1, Math.min(2, model.zoom * factor)), gesture: idle() };
}
function select(model: Model, id: string, recenter: boolean): Model {
  const events = Match.value(model.data).pipe(
    Match.when({ _tag: 'Ready' }, (data) => data.snapshot.events),
    Match.orElse(() => []),
  );
  function selected(event: Earthquake): Model {
    const center = Match.value(recenter).pipe(
      Match.when(true, () => centerAt(event.longitude, event.latitude)),
      Match.orElse(() => model.center),
    );
    return { ...model, selectedId: id, center, gesture: idle() };
  }
  return Option.match(Option.fromNullishOr(events.find((event) => event.id === id)), {
    onNone: () => model,
    onSome: selected,
  });
}
function key(model: Model, pressed: string): Model {
  return Match.value(pressed).pipe(
    Match.when('ArrowRight', () => turn(model, 'east')),
    Match.when('ArrowLeft', () => turn(model, 'west')),
    Match.when('ArrowUp', () => turn(model, 'north')),
    Match.when('ArrowDown', () => turn(model, 'south')),
    Match.when(Match.is('+', '='), () => zoom(model, 1.25)),
    Match.when('-', () => zoom(model, 1 / 1.25)),
    Match.when('Home', () => initModel(model.data)),
    Match.orElse(() => model),
  );
}
function start(model: Model, fact: Extract<Message, { _tag: 'StartedGlobePointer' }>): Model {
  const canStart = Gesture.match(model.gesture, { Idle: () => true, Dragging: () => false });
  const valid =
    canStart &&
    [fact.pointerId, fact.clientX, fact.clientY, fact.renderedBaseRadius].every(Number.isFinite) &&
    fact.renderedBaseRadius > 0;
  return Match.value(valid).pipe(
    Match.when(true, () => ({
      ...model,
      gesture: Gesture.Dragging({
        pointerId: fact.pointerId,
        startX: fact.clientX,
        startY: fact.clientY,
        startCenter: model.center,
        renderedRadius: fact.renderedBaseRadius * model.zoom,
        maxDistance: 0,
      }),
    })),
    Match.orElse(() => model),
  );
}
function move(model: Model, fact: Extract<Message, { _tag: 'MovedGlobePointer' }>): Model {
  function dragging(gesture: Extract<Gesture, { _tag: 'Dragging' }>): Model {
    function advanced(): Model {
      const dx = fact.clientX - gesture.startX;
      const dy = fact.clientY - gesture.startY;
      return {
        ...model,
        center: centerAt(
          gesture.startCenter[0] - (dx / gesture.renderedRadius) * 90,
          gesture.startCenter[1] + (dy / gesture.renderedRadius) * 90,
        ),
        gesture: Gesture.Dragging({
          ...gesture,
          maxDistance: Math.max(gesture.maxDistance, Math.hypot(dx, dy)),
        }),
      };
    }
    return Match.value(
      gesture.pointerId === fact.pointerId && [fact.clientX, fact.clientY].every(Number.isFinite),
    ).pipe(
      Match.when(true, advanced),
      Match.orElse(() => model),
    );
  }
  return Gesture.match(model.gesture, { Idle: () => model, Dragging: dragging });
}
function end(model: Model, pointerId: number): Model {
  function dragging(gesture: Extract<Gesture, { _tag: 'Dragging' }>): Model {
    return Match.value(pointerId === gesture.pointerId).pipe(
      Match.when(true, () => ({
        ...model,
        gesture: Gesture.Idle({ ignoreNextMarkerClick: gesture.maxDistance >= 4 }),
      })),
      Match.orElse(() => model),
    );
  }
  return Gesture.match(model.gesture, { Idle: () => model, Dragging: dragging });
}
function marker(model: Model, id: string, keyboard: boolean): Model {
  const blocked = Gesture.match(model.gesture, {
    Idle: (g) => g.ignoreNextMarkerClick,
    Dragging: () => true,
  });
  return Match.value(!keyboard && blocked).pipe(
    Match.when(true, () => ({ ...model, gesture: idle() })),
    Match.orElse(() => select(model, id, false)),
  );
}
export function update(model: Model, message: Message): Return<Model, Message> {
  const next = Message.match<Model>(message, {
    ClickedZoomIn: () => zoom(model, 1.25),
    ClickedZoomOut: () => zoom(model, 1 / 1.25),
    ClickedReset: () => initModel(model.data),
    ClickedTurn: ({ direction }) => turn(model, direction),
    PressedGlobeKey: ({ key: pressed }) => key(model, pressed),
    ClickedEventRow: ({ id }) => select(model, id, true),
    ClickedMarker: ({ id, keyboard }) => marker(model, id, keyboard),
    StartedGlobePointer: (fact) => start(model, fact),
    MovedGlobePointer: (fact) => move(model, fact),
    EndedGlobePointer: ({ pointerId }) => end(model, pointerId),
    CompletedGlobePointerMount: () => model,
  });
  return { model: next };
}
