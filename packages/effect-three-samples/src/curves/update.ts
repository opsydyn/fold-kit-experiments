import { pointOnPlane } from '@opsydyn/effect-three';
import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import { type Model, startControls, type Vec3 } from './model';

type AppReturn = Return<Model, Message>;

/** The plane the handles move in: z = 0, facing the camera. */
const stage = { normal: [0, 0, 1], constant: 0 } as const;

const handlePrefix = 'handle:';

/** A handle's key: the index of the control point it moves. */
export const handleKey = (index: number): string => `${handlePrefix}${index}`;

const indexOf = (key: string): Option.Option<number> =>
  key.startsWith(handlePrefix)
    ? Option.some(Number(key.slice(handlePrefix.length)))
    : Option.none();

/** Keeps a dragged point on the stage. */
const clamp = ([x, y]: Vec3): Vec3 => [
  Math.min(4, Math.max(-4, x)),
  Math.min(2.4, Math.max(-2.4, y)),
  0,
];

/** Moves the held handle to where the drag ray meets the stage. */
const drag = (model: Model, origin: Vec3, direction: Vec3): Model =>
  Option.match(
    Option.all([model.held, Option.fromNullishOr(pointOnPlane({ origin, direction }, stage))]),
    {
      onNone: () => model,
      onSome: ([held, point]) =>
        modifyFields(model, {
          controls: (controls) =>
            controls.map((control, index) => (index === held ? clamp(point) : control)),
        }),
    },
  );

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    PressedHandle: ({ key }) => ({ model: modifyFields(model, { held: () => indexOf(key) }) }),
    DraggedHandle: ({ origin, direction }) => ({ model: drag(model, origin, direction) }),
    DroppedHandle: () => ({ model: modifyFields(model, { held: () => Option.none() }) }),
    ClickedDashes: () => ({ model: modifyFields(model, { dashed: (dashed) => !dashed }) }),
    ClickedGlitter: () => ({ model: modifyFields(model, { glitter: (glitter) => !glitter }) }),
    ClickedReset: () => ({ model: modifyFields(model, { controls: () => startControls }) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
