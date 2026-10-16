import { overlay } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from '../environment';
import { Message } from './message';
import type { Finish, Lens, Model, Piece, Placement, Shadows, Tone } from './model';
import { sceneFor } from './scene';
import { pieceKey } from './update';

const pieceName = {
  torus: 'Torus',
  capsule: 'Capsule',
  cone: 'Cone',
  ball: 'Ball',
  crate: 'Crate',
} satisfies Record<Piece, string>;

/** Each finish and the three.js material kind behind it. */
const finishName = {
  matte: 'matte (Lambert)',
  glossy: 'glossy (Phong)',
  metal: 'metal (standard)',
  lacquer: 'lacquer (physical, clearcoat)',
  flat: 'flat (basic, unlit)',
} satisfies Record<Finish, string>;

/** The button names the lens it switches to. */
const lensLabel = {
  perspective: 'Orthographic camera',
  orthographic: 'Split view',
  split: 'Perspective camera',
} satisfies Record<Lens, string>;

const shadowsOn = { soft: true, off: false } satisfies Record<Shadows, boolean>;
const filmicOn = { aces: true, none: false } satisfies Record<Tone, boolean>;

const toggle = (h: HtmlBuilder<Message>, label: string, on: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.AriaPressed(String(on)), h.OnClick(message)],
    [label],
  );

const button = (h: HtmlBuilder<Message>, label: string, message: Message): Html =>
  h.button([h.Class('e3-button'), h.Type('button'), h.OnClick(message)], [label]);

const selectedPlacement = (model: Model): Option.Option<Placement> =>
  Option.flatMap(model.selected, (piece) =>
    Option.fromNullishOr(model.placements.find((placement) => placement.piece === piece)),
  );

/** A tag floating over the selected piece: its name and finish, from the Model. */
const tagFor = (h: HtmlBuilder<Message>) => (placement: Placement) => ({
  overlay: overlay({
    key: 'selected-tag',
    node: pieceKey(placement.piece),
    position: [0, 0.9, 0],
    center: true,
  }),
  content: h.span([h.Class('e3-tag')], [`${pieceName[placement.piece]} · ${placement.finish}`]),
  pointerEvents: 'none' as const,
});

const tags = (model: Model, h: HtmlBuilder<Message>) =>
  Option.toArray(Option.map(selectedPlacement(model), tagFor(h)));

const readout = (model: Model): string =>
  Option.match(selectedPlacement(model), {
    onNone: () =>
      'Drag a piece across the floor, or the space around it to orbit. Click one to light it.',
    onSome: (placement) =>
      `${pieceName[placement.piece]}: ${finishName[placement.finish]}. Right-click to change the finish, double-click to send it home.`,
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Studio — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onPointerEnter: ({ key }) => Message.HoveredPiece({ key }),
          onPointerLeave: ({ key }) => Message.LeftPiece({ key }),
          onClick: ({ key }) => Message.ClickedPiece({ key }),
          onDoubleClick: ({ key }) => Message.DoubleClickedPiece({ key }),
          onContextMenu: ({ key }) => Message.OpenedPieceMenu({ key }),
          onPointerDown: ({ key, ray }) =>
            Message.PressedPiece({ key, origin: ray.origin, direction: ray.direction }),
          onDrag: ({ key, ray }) =>
            Message.DraggedPiece({ key, origin: ray.origin, direction: ray.direction }),
          onDragEnd: () => Message.DroppedPiece(),
          onPointerMissed: () => Message.ClickedEmptySpace(),
          onGesture: (gesture) => Message.MadeGesture({ gesture }),
          overlays: tags(model, h),
        },
        h,
      ),
      h.p([h.Class('e3-readout'), h.AriaLive('polite')], [readout(model)]),
      h.div(
        [h.Class('e3-controls')],
        [
          toggle(h, 'Shadows', shadowsOn[model.shadows], Message.ClickedShadows()),
          toggle(h, 'Filmic tone mapping', filmicOn[model.tone], Message.ClickedToneMapping()),
          button(h, lensLabel[model.lens], Message.ClickedLens()),
        ],
      ),
      h.p(
        [h.Class('e3-note')],
        [
          'Every piece is a different geometry and material kind. A press captures the pointer, ',
          'so a drag follows it anywhere; the drag ray meets the floor plane to place the piece.',
        ],
      ),
    ],
  ),
});
