import { type Gesture, movedAlike, orbit, type Placement, type Vec3 } from '@opsydyn/effect-three';
import { BoxSelect, TransformGizmo, ViewportGizmo } from '@opsydyn/effect-three-foldkit';
import { Array as Arr, Option } from 'effect';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import type { Model, Thing } from './model';

type AppReturn = Return<Model, Message>;

/** The snaps a snapping gizmo takes: quarter units, fifteen degrees, quarter scales. */
const snaps = { translationSnap: 0.25, rotationSnap: Math.PI / 12, scaleSnap: 0.25 } as const;
const free = { translationSnap: null, rotationSnap: null, scaleSnap: null } as const;

const thingIn = (things: ReadonlyArray<Thing>, key: string): Option.Option<Thing> =>
  Arr.findFirst(things, (thing) => thing.key === key);

/** The first selected thing: the one the gizmo sits on. */
const selectedThing = (model: Model): Option.Option<Thing> =>
  Option.flatMap(Arr.head(model.selected), (key) => thingIn(model.things, key));

/** Where `self` goes when the gizmo put `moved` at `placement`: there, alike, or nowhere. */
const alike = (model: Model, moved: Thing, self: Thing, placement: Placement): Placement => {
  if (self.key === moved.key) return placement;
  if (!model.selected.includes(self.key)) return self.placement;
  return movedAlike(moved.placement, placement, self.placement);
};

/**
 * Each thing after the gizmo put the first selected at `placement`: that one there, the
 * rest of the selection moved alike from where they were when the drag began.
 */
const placedFrom =
  (model: Model, before: ReadonlyArray<Thing>, placement: Placement) =>
  (thing: Thing): Thing => {
    const first = Option.flatMap(Arr.head(model.selected), (key) => thingIn(before, key));
    const was = Option.all([first, thingIn(before, thing.key)]);
    return Option.match(was, {
      onNone: () => thing,
      onSome: ([moved, self]) => ({
        ...thing,
        placement: alike(model, moved, self, placement),
      }),
    });
  };

const placeSelected = (model: Model, placement: Placement): Model => {
  const before = Option.getOrElse(model.before, () => model.things);
  return { ...model, things: model.things.map(placedFrom(model, before, placement)) };
};

/** A finished move becomes a step of history: the things as they were before it. */
const recorded = (model: Model): Model => {
  const past = Option.match(model.before, {
    onNone: () => model.past,
    onSome: (before) => [...model.past, before],
  });
  return { ...model, past, future: [], before: Option.none() };
};

/** What the gizmo's OutMessage means here: move the selected thing, or record the move. */
const fromGizmo = (model: Model, out: TransformGizmo.OutMessage): Model =>
  TransformGizmo.OutMessage.match(out, {
    Moved: ({ placement }) => placeSelected(model, placement),
    Finished: ({ placement }) => recorded(placeSelected(model, placement)),
  });

/** Runs a gizmo Message, then what its OutMessage asks of the page. */
const withGizmo = (model: Model, message: TransformGizmo.Message): Model => {
  const result = TransformGizmo.update(model.gizmo, message);
  const next = { ...model, gizmo: result.model };
  return result.outMessage === undefined ? next : fromGizmo(next, result.outMessage);
};

/** The viewport gizmo's Message, and the camera it turns to. */
const withView = (model: Model, message: ViewportGizmo.Message): Model => {
  const result = ViewportGizmo.update(model.view, message);
  const camera = result.outMessage?.camera ?? model.camera;
  return { ...model, view: result.model, camera };
};

/** A press on a gizmo handle takes hold, remembering the things as they were. */
const pressGizmo = (model: Model, key: string, origin: Vec3, direction: Vec3): Model =>
  Option.match(Option.all([TransformGizmo.handleOf(model.gizmo, key), selectedThing(model)]), {
    onNone: () => model,
    onSome: ([handle, thing]) =>
      withGizmo(
        { ...model, before: Option.some(model.things) },
        TransformGizmo.Message.Pressed({
          handle,
          origin,
          direction,
          placement: thing.placement,
          camera: model.camera,
        }),
      ),
  });

/** A press on the viewport gizmo turns the camera; anywhere else, it may take the gizmo. */
const press = (model: Model, key: string, origin: Vec3, direction: Vec3): Model =>
  Option.isSome(ViewportGizmo.axisOf(model.view, key))
    ? withView(
        { ...model, pressedView: true },
        ViewportGizmo.Message.Pressed({ key, camera: model.camera }),
      )
    : pressGizmo({ ...model, pressedView: false }, key, origin, direction);

/** A click on nothing clears the selection, unless it began on the viewport gizmo. */
const clickNothing = (model: Model): Model =>
  model.pressedView ? { ...model, pressedView: false } : { ...model, selected: [] };

/** The camera orbits on a gesture that began on nothing, while the gizmo is not held. */
const orbits = (model: Model, gesture: Gesture): boolean =>
  !TransformGizmo.held(model.gizmo) && !('key' in gesture && gesture.key !== undefined);

/** The camera after a gesture that orbits; otherwise as it was. */
const orbitBy = (model: Model, gesture: Gesture): Model =>
  orbits(model, gesture) ? { ...model, camera: orbit(model.camera, gesture) } : model;

/** A shift-drag on nothing draws the selection box; any other gesture may orbit. */
const gesture = (model: Model, made: Gesture): Model =>
  made._tag === 'Drag' && BoxSelect.claims(model.box, made)
    ? { ...model, box: BoxSelect.update(model.box, BoxSelect.dragOf(made)).model }
    : orbitBy(model, made);

/** Letting go of the box selects what it holds. */
const endBox = (model: Model): Model => {
  const selectable = model.things.map(({ key, placement }) => ({ key, at: placement.position }));
  const result = BoxSelect.update(
    model.box,
    BoxSelect.Message.Ended({ camera: model.camera, selectable }),
  );
  const selected = result.outMessage?.keys ?? model.selected;
  return { ...model, box: result.model, selected };
};

const undo = (model: Model): Model =>
  Option.match(Arr.last(model.past), {
    onNone: () => model,
    onSome: (things) => ({
      ...model,
      things,
      past: model.past.slice(0, -1),
      future: [model.things, ...model.future],
    }),
  });

const redo = (model: Model): Model =>
  Option.match(Arr.head(model.future), {
    onNone: () => model,
    onSome: (things) => ({
      ...model,
      things,
      past: [...model.past, model.things],
      future: model.future.slice(1),
    }),
  });

const isThing = (model: Model, key: string): boolean =>
  model.things.some((thing) => thing.key === key);

/** Selects a thing that is clicked; a click on a gizmo handle changes nothing. */
const select = (model: Model, key: string): Model =>
  isThing(model, key)
    ? { ...model, selected: [key], pressedView: false }
    : { ...model, pressedView: false };

/** A drag or release goes to the gizmo only while it is held. */
const whileHeld = (model: Model, message: TransformGizmo.Message): Model =>
  TransformGizmo.held(model.gizmo) ? withGizmo(model, message) : model;

/** Over a gizmo handle: highlighted. */
const hover = (model: Model, key: string): Model =>
  Option.match(TransformGizmo.handleOf(model.gizmo, key), {
    onNone: () => model,
    onSome: (handle) => withGizmo(model, TransformGizmo.Message.Hovered({ handle })),
  });

/** Leaving a gizmo handle clears its highlight. */
const leave = (model: Model, key: string): Model =>
  Option.isSome(TransformGizmo.handleOf(model.gizmo, key))
    ? withGizmo(model, TransformGizmo.Message.Hovered({ handle: null }))
    : model;

const otherSpace = { world: 'local', local: 'world' } as const;

/** Snapping on or off: the gizmo's snaps with it. */
const toggleSnapping = (model: Model): Model => {
  const snapping = !model.snapping;
  const steps = snapping ? snaps : free;
  return {
    ...model,
    snapping,
    gizmo: { ...model.gizmo, gizmo: { ...model.gizmo.gizmo, ...steps } },
  };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    PressedScene: ({ key, origin, direction }) => ({ model: press(model, key, origin, direction) }),
    DraggedScene: ({ origin, direction }) => ({
      model: whileHeld(model, TransformGizmo.Message.Dragged({ origin, direction })),
    }),
    ReleasedScene: () => ({ model: whileHeld(model, TransformGizmo.Message.Released()) }),
    ClickedThing: ({ key }) => ({ model: select(model, key) }),
    ClickedNothing: () => ({ model: clickNothing(model) }),
    HoveredScene: ({ key }) => ({
      model: withView(hover(model, key), ViewportGizmo.Message.Entered({ key })),
    }),
    LeftScene: ({ key }) => ({
      model: withView(leave(model, key), ViewportGizmo.Message.Left({ key })),
    }),
    MadeGesture: ({ gesture: made }) => ({ model: gesture(model, made) }),
    EndedGesture: () => ({ model: endBox(model) }),
    ChoseMode: ({ mode }) => ({
      model: withGizmo(model, TransformGizmo.Message.ChoseMode({ mode })),
    }),
    ClickedSpace: () => ({
      model: withGizmo(
        model,
        TransformGizmo.Message.ChoseSpace({ space: otherSpace[model.gizmo.gizmo.space] }),
      ),
    }),
    ClickedSnapping: () => ({ model: toggleSnapping(model) }),
    ClickedUndo: () => ({ model: undo(model) }),
    ClickedRedo: () => ({ model: redo(model) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
