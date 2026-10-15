import { pointOnPlane, type Vec3 } from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

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

const otherLens = { perspective: 'orthographic', orthographic: 'perspective' } satisfies Record<
  Lens,
  Lens
>;
const otherShadows = { soft: 'off', off: 'soft' } satisfies Record<Shadows, Shadows>;
const otherTone = { none: 'aces', aces: 'none' } satisfies Record<Tone, Tone>;

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
    ClickedLens: () => ({ model: modifyFields(model, { lens: (lens) => otherLens[lens] }) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
