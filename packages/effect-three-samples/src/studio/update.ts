import {
  type Box,
  fitCamera,
  type Gesture,
  noModifiers,
  orbit,
  orbitKey,
  pointOnPlane,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { homeCamera, studioOrbit, viewKey } from './cameras';
import { Message } from './message';
import {
  finishes,
  type Grab,
  home,
  type Lens,
  limit,
  type Model,
  type Piece,
  pieces,
  type Placement,
  type Shadows,
  type Tone,
} from './model';

type AppReturn = Return<Model, Message>;

const floor = { normal: [0, 1, 0], constant: 0 } as const;

export const pieceKey = (piece: Piece): string => `piece:${piece}`;

/** Reads a piece back from its scene key. */
export const pieceOf = (key: string): Option.Option<Piece> =>
  Option.fromNullishOr(pieces.find((piece) => pieceKey(piece) === key));

const clamp = (value: number): number => Math.max(-limit, Math.min(limit, value));

/** Applies `change` to the placement of `piece`, leaving the others alone. */
const onPiece =
  (piece: Piece, change: (placement: Placement) => Placement) =>
  (placement: Placement): Placement =>
    Option.match(
      Option.liftPredicate(placement, (candidate) => candidate.piece === piece),
      { onNone: () => placement, onSome: change },
    );

const placeAt = (piece: Piece, x: number, z: number) =>
  onPiece(piece, (placement) => ({ ...placement, x: clamp(x), z: clamp(z) }));

const withPlacements = (model: Model, change: (placement: Placement) => Placement): Model => ({
  ...model,
  placements: model.placements.map(change),
});

const nextFinish = (placement: Placement): Placement => ({
  ...placement,
  finish: finishes[(finishes.indexOf(placement.finish) + 1) % finishes.length] ?? 'matte',
});

const placementOf = (model: Model, piece: Piece): Option.Option<Placement> =>
  Option.fromNullishOr(model.placements.find((placement) => placement.piece === piece));

/** Takes hold of a piece where the press ray meets the floor, so a drag moves it from there. */
const press = (model: Model, piece: Piece, origin: Vec3, direction: Vec3): Model =>
  Option.match(Option.fromNullishOr(pointOnPlane({ origin, direction }, floor)), {
    onNone: () => model,
    onSome: (point) => ({ ...model, grab: grabFor(model, piece, point) }),
  });

/** The grab for this drag: the current one for `piece`, or a new one from where it was taken. */
const grabFor = (model: Model, piece: Piece, point: Vec3): Option.Option<Grab> =>
  Option.orElse(
    Option.filter(model.grab, (grab) => grab.piece === piece),
    () =>
      Option.map(placementOf(model, piece), (placement) => ({
        piece,
        offsetX: point[0] - placement.x,
        offsetZ: point[2] - placement.z,
      })),
  );

/** Places the grabbed piece so the point it was grabbed by sits under the pointer. */
const moveGrabbed =
  (model: Model, piece: Piece, point: Vec3) =>
  (grab: Grab): Model => {
    const moved = withPlacements(
      model,
      placeAt(piece, point[0] - grab.offsetX, point[2] - grab.offsetZ),
    );
    return { ...moved, grab: Option.some(grab), selected: Option.some(piece) };
  };

const dragTo =
  (model: Model, piece: Piece) =>
  (point: Vec3): Model =>
    Option.match(grabFor(model, piece, point), {
      onNone: () => model,
      onSome: moveGrabbed(model, piece, point),
    });

/** Moves a dragged piece to where the drag ray meets the floor. */
const drag = (model: Model, piece: Piece, origin: Vec3, direction: Vec3): Model =>
  Option.match(Option.fromNullishOr(pointOnPlane({ origin, direction }, floor)), {
    onNone: () => model,
    onSome: dragTo(model, piece),
  });

const withPiece = (key: string, model: Model, apply: (piece: Piece) => Model): AppReturn => {
  const next = Option.match(pieceOf(key), { onNone: () => model, onSome: apply });
  return { model: next };
};

/** Lenses cycle: perspective, orthographic, then a split of both. */
const otherLens = {
  perspective: 'orthographic',
  orthographic: 'split',
  split: 'perspective',
} satisfies Record<Lens, Lens>;
const otherShadows = { soft: 'off', off: 'soft' } satisfies Record<Shadows, Shadows>;
const otherTone = { none: 'aces', aces: 'none' } satisfies Record<Tone, Tone>;

/**
 * Whether a gesture moves the camera: not one that began on a piece (that drags the
 * piece), and not one over the plan, which stays put.
 */
const orbits = (gesture: Gesture): boolean =>
  !('key' in gesture && gesture.key !== undefined) && gesture.view !== viewKey.plan;

/** The camera after a gesture, when the gesture is one that orbits. */
const orbitBy = (model: Model, gesture: Gesture): Model =>
  Option.match(Option.liftPredicate(gesture, orbits), {
    onNone: () => model,
    onSome: (orbiting) => ({ ...model, camera: orbit(model.camera, orbiting, studioOrbit) }),
  });

/** Gestures carry the stage's size: keep it, for arrow keys. */
const withStage = (model: Model, gesture: Gesture): Model => ({
  ...model,
  stage: { width: gesture.width, height: gesture.height },
});

/** A piece's newly measured box, replacing its last. */
const measured = (model: Model, key: string, min: Vec3, max: Vec3): Model =>
  Option.match(pieceOf(key), {
    onNone: () => model,
    onSome: (piece) => ({
      ...model,
      bounds: [...model.bounds.filter((box) => box.piece !== piece), { piece, min, max }],
    }),
  });

/** Per axis, `pick` (Math.min or Math.max) across the points. */
const across = (points: ReadonlyArray<Vec3>, pick: (...values: Array<number>) => number): Vec3 => [
  pick(...points.map((point) => point[0])),
  pick(...points.map((point) => point[1])),
  pick(...points.map((point) => point[2])),
];

/** The box around every piece, or nothing before they are measured. */
const allPieces = (model: Model): Option.Option<Box> =>
  Option.liftPredicate(model.bounds, (bounds) => bounds.length > 0).pipe(
    Option.map((bounds) => ({
      min: across(
        bounds.map((box) => box.min),
        Math.min,
      ),
      max: across(
        bounds.map((box) => box.max),
        Math.max,
      ),
    })),
  );

/** The camera framing every piece, as Drei's Bounds fits, eased by its damping. */
const framed = (model: Model): Model =>
  Option.match(allPieces(model), {
    onNone: () => model,
    onSome: (box) => ({ ...model, camera: fitCamera(model.camera, box, model.stage) }),
  });

/** The next lens, from its own starting camera. */
const nextLens = (model: Model): Model => {
  const lens = otherLens[model.lens];
  return { ...model, lens, camera: homeCamera[lens] };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    HoveredPiece: ({ key }) =>
      withPiece(key, model, (piece) => modifyFields(model, { hovered: () => Option.some(piece) })),
    LeftPiece: ({ key }) =>
      withPiece(key, model, (piece) =>
        modifyFields(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => current !== piece),
        }),
      ),
    ClickedPiece: ({ key }) =>
      withPiece(key, model, (piece) => modifyFields(model, { selected: () => Option.some(piece) })),
    DoubleClickedPiece: ({ key }) =>
      withPiece(key, model, (piece) =>
        withPlacements(model, placeAt(piece, home[piece].x, home[piece].z)),
      ),
    OpenedPieceMenu: ({ key }) =>
      withPiece(key, model, (piece) => withPlacements(model, onPiece(piece, nextFinish))),
    PressedPiece: ({ key, origin, direction }) =>
      withPiece(key, model, (piece) =>
        press(modifyFields(model, { grab: () => Option.none() }), piece, origin, direction),
      ),
    DraggedPiece: ({ key, origin, direction }) =>
      withPiece(key, model, (piece) => drag(model, piece, origin, direction)),
    DroppedPiece: () => ({ model: modifyFields(model, { grab: () => Option.none() }) }),
    ClickedEmptySpace: () => ({ model: modifyFields(model, { selected: () => Option.none() }) }),
    ClickedShadows: () => ({
      model: modifyFields(model, { shadows: (shadows) => otherShadows[shadows] }),
    }),
    ClickedToneMapping: () => ({ model: modifyFields(model, { tone: (tone) => otherTone[tone] }) }),
    ClickedLens: () => ({ model: nextLens(model) }),
    MadeGesture: ({ gesture }) => ({ model: orbitBy(withStage(model, gesture), gesture) }),
    PressedArrow: ({ key, turning }) => ({
      model: {
        ...model,
        camera: orbitKey(
          model.camera,
          key,
          { ...noModifiers, shift: turning },
          model.stage,
          studioOrbit,
        ),
      },
    }),
    MeasuredPiece: ({ key, min, max }) => ({ model: measured(model, key, min, max) }),
    ClickedFrame: () => ({ model: framed(model) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
