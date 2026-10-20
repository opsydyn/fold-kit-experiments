import {
  type Gesture,
  History,
  movedAlike,
  orbit,
  type Placement,
  type Vec3,
} from '@opsydyn/effect-three';
import {
  BoxSelect,
  MeasuringTape,
  PivotControls,
  TransformGizmo,
  ViewportGizmo,
} from '@opsydyn/effect-three-foldkit';
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

/** A finished move becomes a step of history, named for what moved. */
const recorded = (model: Model): Model => ({
  ...model,
  history: History.record(model.history, model.things, `Moved ${model.selected.join(', ')}`),
  before: Option.none(),
});

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

/** What the pivot controls' OutMessage means here: the same as the gizmo's. */
const fromPivot = (model: Model, out: PivotControls.OutMessage): Model =>
  PivotControls.OutMessage.match(out, {
    Moved: ({ placement }) => placeSelected(model, placement),
    Finished: ({ placement }) => recorded(placeSelected(model, placement)),
  });

/** Runs a pivot Message, then what its OutMessage asks of the page. */
const withPivot = (model: Model, message: PivotControls.Message): Model => {
  const result = PivotControls.update(model.pivot, message);
  const next = { ...model, pivot: result.model };
  return result.outMessage === undefined ? next : fromPivot(next, result.outMessage);
};

/** A press on a pivot handle takes hold where it hit, remembering the things as they were. */
const pressPivot = (model: Model, key: string, point: Vec3): Model =>
  Option.match(Option.all([PivotControls.handleOf(model.pivot, key), selectedThing(model)]), {
    onNone: () => model,
    onSome: ([handle, thing]) =>
      withPivot(
        { ...model, before: Option.some(model.things) },
        PivotControls.Message.Pressed({ handle, point, placement: thing.placement }),
      ),
  });

/** Whether either way of moving things is held: the camera keeps still while it is. */
const holding = (model: Model): boolean =>
  TransformGizmo.held(model.gizmo) || PivotControls.held(model.pivot);

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
const press = (model: Model, key: string, point: Vec3, origin: Vec3, direction: Vec3): Model => {
  if (Option.isSome(ViewportGizmo.axisOf(model.view, key))) {
    return withView(
      { ...model, pressedView: true },
      ViewportGizmo.Message.Pressed({ key, camera: model.camera }),
    );
  }
  const pressed = { ...model, pressedView: false };
  return model.style === 'pivot'
    ? pressPivot(pressed, key, point)
    : pressGizmo(pressed, key, origin, direction);
};

/** A click on nothing clears the selection, unless it began on the viewport gizmo. */
const clickNothing = (model: Model): Model =>
  model.pressedView ? { ...model, pressedView: false } : { ...model, selected: [] };

/** A gesture that began on nothing, or on the table (which is picked while measuring). */
const offThings = (gesture: Gesture): boolean =>
  !('key' in gesture) || gesture.key === undefined || gesture.key === 'table';

/** The camera orbits on a gesture off the things, while no gizmo is held. */
const orbits = (model: Model, gesture: Gesture): boolean => !holding(model) && offThings(gesture);

/** The camera after a gesture that orbits; otherwise as it was. */
const orbitBy = (model: Model, gesture: Gesture): Model =>
  orbits(model, gesture)
    ? { ...model, camera: orbit(model.camera, gesture), orbited: true }
    : model;

/** The tape's Message; what it measures shows in the readout, from the Model. */
const withTape = (model: Model, message: MeasuringTape.Message): Model => ({
  ...model,
  tape: MeasuringTape.update(model.tape, message).model,
});

/** While measuring, the tape runs to the pointer. */
const moveOver = (model: Model, point: Vec3): Model =>
  model.measuring ? withTape(model, MeasuringTape.Message.Pointed({ point })) : model;

/** Measuring on or off: the tape starts empty either way. */
const toggleMeasuring = (model: Model): Model => ({
  ...withTape(model, MeasuringTape.Message.Cleared()),
  measuring: !model.measuring,
});

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

/** The things as the history has them now. */
const travelled = (model: Model, history: Model['history']): Model => ({
  ...model,
  history,
  things: History.present(history),
});

const undo = (model: Model): Model => travelled(model, History.undo(model.history));

const redo = (model: Model): Model => travelled(model, History.redo(model.history));

/** Redo takes the next branch from here, round to the first after the last. */
const nextBranch = (model: Model): Model => {
  const choices = History.branches(model.history);
  const taken = choices.findIndex((entry) => entry.id === History.presentEntry(model.history).next);
  const next = choices[(taken + 1) % Math.max(choices.length, 1)];
  return next === undefined
    ? model
    : { ...model, history: History.chooseBranch(model.history, next.id) };
};

const isThing = (model: Model, key: string): boolean =>
  model.things.some((thing) => thing.key === key);

/** Selects a thing that is clicked; a click on a gizmo handle changes nothing. */
const select = (model: Model, key: string): Model =>
  isThing(model, key)
    ? { ...model, selected: [key], pressedView: false }
    : { ...model, pressedView: false };

/** While measuring, a click (not the end of an orbit) places a tape end where it hit. */
const clickThing = (model: Model, key: string, point: Vec3): Model => {
  if (!model.measuring) return select(model, key);
  return model.orbited ? model : withTape(model, MeasuringTape.Message.Placed({ point }));
};

/** A drag or release goes to the gizmo only while it is held. */
const whileHeld = (model: Model, message: TransformGizmo.Message): Model =>
  TransformGizmo.held(model.gizmo) ? withGizmo(model, message) : model;

/** A drag goes to the pivot controls while they are held, else to the gizmo. */
const drag = (model: Model, origin: Vec3, direction: Vec3): Model =>
  PivotControls.held(model.pivot)
    ? withPivot(model, PivotControls.Message.Dragged({ origin, direction, snap: model.snapping }))
    : whileHeld(model, TransformGizmo.Message.Dragged({ origin, direction }));

const release = (model: Model): Model =>
  PivotControls.held(model.pivot)
    ? withPivot(model, PivotControls.Message.Released())
    : whileHeld(model, TransformGizmo.Message.Released());

/** Over a pivot handle: highlighted. */
const hoverPivot = (model: Model, key: string): Model =>
  Option.match(PivotControls.handleOf(model.pivot, key), {
    onNone: () => model,
    onSome: (handle) => withPivot(model, PivotControls.Message.Hovered({ handle })),
  });

const leavePivot = (model: Model, key: string): Model =>
  Option.isSome(PivotControls.handleOf(model.pivot, key))
    ? withPivot(model, PivotControls.Message.Hovered({ handle: null }))
    : model;

const otherStyle = { transform: 'pivot', pivot: 'transform' } as const;

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
    tape: { ...model.tape, tape: { ...model.tape.tape, snap: steps.translationSnap } },
  };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    PressedScene: ({ key, point, origin, direction }) => ({
      model: press({ ...model, orbited: false }, key, point, origin, direction),
    }),
    DraggedScene: ({ origin, direction }) => ({ model: drag(model, origin, direction) }),
    ReleasedScene: () => ({ model: release(model) }),
    ClickedThing: ({ key, point }) => ({ model: clickThing(model, key, point) }),
    MovedOver: ({ point }) => ({ model: moveOver(model, point) }),
    ClickedNothing: () => ({ model: clickNothing(model) }),
    HoveredScene: ({ key }) => ({
      model: withView(hoverPivot(hover(model, key), key), ViewportGizmo.Message.Entered({ key })),
    }),
    LeftScene: ({ key }) => ({
      model: withTape(
        withView(leavePivot(leave(model, key), key), ViewportGizmo.Message.Left({ key })),
        MeasuringTape.Message.Pointed({ point: null }),
      ),
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
    ClickedPivot: () => ({ model: { ...model, style: otherStyle[model.style] } }),
    ClickedMeasure: () => ({ model: toggleMeasuring(model) }),
    ClickedUndo: () => ({ model: undo(model) }),
    ClickedRedo: () => ({ model: redo(model) }),
    ClickedBranch: () => ({ model: nextBranch(model) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
