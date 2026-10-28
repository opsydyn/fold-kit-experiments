import { Match, Option } from 'effect';
import type { Return } from 'foldkit/update';

import { ringIds } from '../three/data';
import { categoryCenter, filterPositions, layoutEntries, type RadarPosition } from './geometry';
import { Message } from './message';
import { Gesture, Selection, type Model } from './model';

const idle = () => Gesture.Idle({ ignoreNextBlipClick: false });
const centerAt = (longitude: number, latitude: number): Model['center'] => [
  ((((longitude + 180) % 360) + 360) % 360) - 180,
  Math.max(-90, Math.min(90, latitude)),
];
function matching(model: Model): ReadonlyArray<RadarPosition> {
  return Match.value(model.data).pipe(
    Match.when({ _tag: 'Ready' }, ({ dataset }) =>
      filterPositions(layoutEntries(dataset.entries), {
        query: model.query,
        category: model.category,
        rings: model.enabledRings,
      }),
    ),
    Match.orElse(() => []),
  );
}
function reconcile(model: Model): Model {
  function selected(selection: Extract<Selection, { _tag: 'Selected' }>): Model {
    return Match.value(matching(model).some(({ entry }) => entry.id === selection.id)).pipe(
      Match.when(true, () => model),
      Match.orElse(() => ({ ...model, selection: Selection.Cleared() })),
    );
  }
  return Selection.match(model.selection, {
    None: () => model,
    Cleared: () => model,
    Selected: selected,
  });
}
function select(model: Model, id: string, recenter: boolean): Model {
  function selected(position: RadarPosition): Model {
    const center = Match.value(recenter).pipe(
      Match.when(true, () => centerAt(position.longitude, position.latitude)),
      Match.orElse(() => model.center),
    );
    return { ...model, selection: Selection.Selected({ id }), center, gesture: idle() };
  }
  return Option.match(Option.fromNullishOr(matching(model).find(({ entry }) => entry.id === id)), {
    onNone: () => model,
    onSome: selected,
  });
}
function turn(
  model: Model,
  direction: Extract<Message, { _tag: 'ClickedTurn' }>['direction'],
): Model {
  const offsets = {
    east: { longitude: 15, latitude: 0 },
    west: { longitude: -15, latitude: 0 },
    north: { longitude: 0, latitude: 15 },
    south: { longitude: 0, latitude: -15 },
  };
  return {
    ...model,
    center: centerAt(
      model.center[0] + offsets[direction].longitude,
      model.center[1] + offsets[direction].latitude,
    ),
    gesture: idle(),
  };
}
function zoom(model: Model, factor: number): Model {
  return { ...model, zoom: Math.max(1, Math.min(2, model.zoom * factor)), gesture: idle() };
}
function resetView(model: Model): Model {
  return { ...model, center: [0, 20], zoom: 1, gesture: idle() };
}
function key(model: Model, pressed: string): Model {
  return Match.value(pressed).pipe(
    Match.when('ArrowRight', () => turn(model, 'east')),
    Match.when('ArrowLeft', () => turn(model, 'west')),
    Match.when('ArrowUp', () => turn(model, 'north')),
    Match.when('ArrowDown', () => turn(model, 'south')),
    Match.when(Match.is('+', '='), () => zoom(model, 1.25)),
    Match.when('-', () => zoom(model, 1 / 1.25)),
    Match.when('Home', () => resetView(model)),
    Match.orElse(() => model),
  );
}
function start(model: Model, fact: Extract<Message, { _tag: 'StartedRadarPointer' }>): Model {
  const renderedRadius = fact.renderedBaseRadius * model.zoom;
  const available = Gesture.match(model.gesture, { Idle: () => true, Dragging: () => false });
  const valid =
    available &&
    [fact.pointerId, fact.clientX, fact.clientY, fact.renderedBaseRadius, renderedRadius].every(
      Number.isFinite,
    ) &&
    fact.renderedBaseRadius > 0 &&
    renderedRadius > 0;
  return Match.value(valid).pipe(
    Match.when(true, () => ({
      ...model,
      gesture: Gesture.Dragging({
        pointerId: fact.pointerId,
        startX: fact.clientX,
        startY: fact.clientY,
        startCenter: model.center,
        renderedRadius,
        maxDistance: 0,
      }),
    })),
    Match.orElse(() => model),
  );
}
function move(model: Model, fact: Extract<Message, { _tag: 'MovedRadarPointer' }>): Model {
  function dragging(gesture: Extract<Gesture, { _tag: 'Dragging' }>): Model {
    const dx = fact.clientX - gesture.startX;
    const dy = fact.clientY - gesture.startY;
    const longitude = gesture.startCenter[0] - (dx / gesture.renderedRadius) * 90;
    const latitude = gesture.startCenter[1] + (dy / gesture.renderedRadius) * 90;
    const distance = Math.hypot(dx, dy);
    const valid =
      gesture.pointerId === fact.pointerId &&
      [fact.clientX, fact.clientY, longitude, latitude, distance].every(Number.isFinite);
    return Match.value(valid).pipe(
      Match.when(true, () => ({
        ...model,
        center: centerAt(longitude, latitude),
        gesture: Gesture.Dragging({
          ...gesture,
          maxDistance: Math.max(distance, gesture.maxDistance),
        }),
      })),
      Match.orElse(() => model),
    );
  }
  return Gesture.match(model.gesture, { Idle: () => model, Dragging: dragging });
}
function end(model: Model, pointerId: number): Model {
  function dragging(gesture: Extract<Gesture, { _tag: 'Dragging' }>): Model {
    return Match.value(gesture.pointerId === pointerId).pipe(
      Match.when(true, () => ({
        ...model,
        gesture: Gesture.Idle({ ignoreNextBlipClick: gesture.maxDistance > 4 }),
      })),
      Match.orElse(() => model),
    );
  }
  return Gesture.match(model.gesture, { Idle: () => model, Dragging: dragging });
}
function blip(model: Model, id: string, keyboard: boolean): Model {
  const blocked = Gesture.match(model.gesture, {
    Idle: ({ ignoreNextBlipClick }) => ignoreNextBlipClick,
    Dragging: () => true,
  });
  return Match.value(blocked && !keyboard).pipe(
    Match.when(true, () => ({ ...model, gesture: idle() })),
    Match.orElse(() => select(model, id, false)),
  );
}
function changeCategory(model: Model, category: Model['category']): Model {
  const center = Match.value(category).pipe(
    Match.when('all', () => model.center),
    Match.orElse(categoryCenter),
  );
  return reconcile({ ...model, category, center, gesture: idle() });
}
export function update(model: Model, message: Message): Return<Model, Message> {
  const next = Message.match<Model>(message, {
    ChangedQuery: ({ query }) => reconcile({ ...model, query, gesture: idle() }),
    ChangedCategory: ({ category }) => changeCategory(model, category),
    ClickedRing: ({ ring }) =>
      reconcile({
        ...model,
        enabledRings: ringIds.filter(
          (candidate) => model.enabledRings.includes(candidate) !== (candidate === ring),
        ),
        gesture: idle(),
      }),
    ClickedClearFilters: () =>
      reconcile({ ...model, query: '', category: 'all', enabledRings: ringIds, gesture: idle() }),
    ClickedResetView: () => resetView(model),
    ClickedZoomIn: () => zoom(model, 1.25),
    ClickedZoomOut: () => zoom(model, 1 / 1.25),
    ClickedTurn: ({ direction }) => turn(model, direction),
    PressedRadarKey: ({ key: pressed }) => key(model, pressed),
    ClickedBlip: ({ id, keyboard }) => blip(model, id, keyboard),
    ClickedEntryRow: ({ id }) => select(model, id, true),
    StartedRadarPointer: (fact) => start(model, fact),
    MovedRadarPointer: (fact) => move(model, fact),
    EndedRadarPointer: ({ pointerId }) => end(model, pointerId),
    CompletedRadarPointerMount: () => model,
  });
  return { model: next };
}
