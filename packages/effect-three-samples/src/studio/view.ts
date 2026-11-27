import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { overlay } from '@opsydyn/effect-three';
import { Option } from 'effect';

import { type SceneOverlay, sceneOverlayLayer, withSceneOverlays } from '../effect-ui-overlays';
import { EffectThreeStage, unlabelledSceneMount } from '../effect-ui-scene';
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

const button = (h: Html.H<Message>, label: string, message: Message) =>
  h.button.class('e3-button').attr('type', 'button').on('click', message).children(label);

const toggle = (h: Html.H<Message>, label: string, on: boolean, message: Message) =>
  button(h, label, message).attr('aria-pressed', String(on));

const selectedPlacement = (model: Model): Option.Option<Placement> =>
  Option.flatMap(model.selected, (piece) =>
    Option.fromNullishOr(model.placements.find((placement) => placement.piece === piece)),
  );

/** A tag floating over the selected piece: its name and finish, from the Model. */
const tagFor =
  (h: Html.H<Message>) =>
  (placement: Placement): SceneOverlay<Message> => ({
    overlay: overlay({
      key: 'selected-tag',
      node: pieceKey(placement.piece),
      position: [0, 0.9, 0],
      center: true,
    }),
    content: h.span.class('e3-tag').children(`${pieceName[placement.piece]} · ${placement.finish}`),
    pointerEvents: 'none',
  });

const tags = (model: Model, h: Html.H<Message>) =>
  Option.toArray(Option.map(selectedPlacement(model), tagFor(h)));

const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** Arrow keys move the camera while the stage has focus (shift turns); others pass. */
const arrowKey = (key: string, shift: boolean): Option.Option<Message> =>
  Option.map(Option.fromNullishOr(arrows.find((arrow) => arrow === key)), (arrow) =>
    Message.PressedArrow({ key: arrow, turning: shift }),
  );

const readout = (model: Model): string =>
  Option.match(selectedPlacement(model), {
    onNone: () =>
      'Drag a piece across the floor, or the space around it to orbit. Click one to light it.',
    onSome: (placement) =>
      `${pieceName[placement.piece]}: ${finishName[placement.finish]}. Right-click to change the finish, double-click to send it home.`,
  });

export const view = (h: Html.H<Message>, model: Model) => {
  const overlays = tags(model, h);
  const scene = withSceneOverlays(sceneFor(model), overlays);
  return h.div.class('e3-sample').children(
    h.div
      .attr('tabindex', '0')
      .attr('aria-label', 'Studio scene. Arrow keys pan the camera. Hold Shift to turn.')
      .on('keydown', ({ key, shift }) => Option.getOrUndefined(arrowKey(key, shift)), {
        preventDefault: true,
      })
      .children(
        EffectThreeStage(h)
          .class('e3-stage')
          .on('scene-pointer-enter', ({ key }) => Message.HoveredPiece({ key }))
          .on('scene-pointer-leave', ({ key }) => Message.LeftPiece({ key }))
          .on('scene-click', ({ key }) => Message.ClickedPiece({ key }))
          .on('scene-double-click', ({ key }) => Message.DoubleClickedPiece({ key }))
          .on('scene-context-menu', ({ key }) => Message.OpenedPieceMenu({ key }))
          .on('scene-pointer-down', ({ key, ray }) =>
            Message.PressedPiece({ key, origin: ray.origin, direction: ray.direction }),
          )
          .on('scene-drag', ({ key, ray }) =>
            Message.DraggedPiece({ key, origin: ray.origin, direction: ray.direction }),
          )
          .on('scene-drag-end', Message.DroppedPiece())
          .on('scene-pointer-missed', Message.ClickedEmptySpace())
          .on('scene-gesture', ({ gesture }) => Message.MadeGesture({ gesture }))
          .on('scene-measured', ({ key, min, max }) => Message.MeasuredPiece({ key, min, max }))
          .onMount(
            Mount.map(unlabelledSceneMount({ scene }), (lifecycle) =>
              Message.ReceivedSceneLifecycle({ lifecycle }),
            ),
          )
          .children(sceneOverlayLayer(h, overlays)),
      ),
    h.p.class('e3-readout').attr('aria-live', 'polite').children(readout(model)),
    h.div
      .class('e3-controls')
      .children(
        toggle(h, 'Shadows', shadowsOn[model.shadows], Message.ClickedShadows()),
        toggle(h, 'Filmic tone mapping', filmicOn[model.tone], Message.ClickedToneMapping()),
        button(h, lensLabel[model.lens], Message.ClickedLens()),
        button(h, 'Frame the pieces', Message.ClickedFrame()),
      ),
    h.p
      .class('e3-note')
      .children(
        'Every piece is a different geometry and material kind. A press captures the pointer, ',
        'so a drag follows it anywhere. The drag ray meets the floor plane to place the piece.',
      ),
  );
};
