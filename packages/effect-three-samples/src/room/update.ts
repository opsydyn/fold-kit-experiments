import { glided, type Gesture, orbit, orbitOptions } from '@opsydyn/effect-three';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { CheckSupport, Enter, Exit } from './command';
import { Message } from './message';
import { initialModel, type Model, mostPlants, type PlantKind } from './model';

type AppReturn = Return<Model, Message>;

/** A plant of `kind` at `point`, the oldest going once there are too many. */
const planted = (
  model: Model,
  point: readonly [number, number, number],
  kind: PlantKind,
): Model => ({
  ...model,
  plants: [...model.plants, { id: `plant-${model.nextPlant}`, at: point, kind }].slice(-mostPlants),
  nextPlant: model.nextPlant + 1,
});

/** On the floor, within the room's walls. */
const onFloor = (at: readonly [number, number, number]): readonly [number, number, number] => [
  Math.min(2.8, Math.max(-2.8, at[0])),
  0,
  Math.min(2.8, Math.max(-2.8, at[2])),
];

const support = { true: 'ready', false: 'unavailable' } as const;

const orbitLimits = orbitOptions({
  minDistance: 2,
  maxDistance: 9,
  maxPolarAngle: 1.45,
  minAzimuthAngle: -0.4,
  maxAzimuthAngle: 1.6,
});

/** Look around, unless the gesture began on something to click. */
const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
  commands: [CheckSupport({ mode: 'immersive-vr' }), CheckSupport({ mode: 'immersive-ar' })],
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    CheckedSupport: ({ mode, supported }) => ({
      model:
        mode === 'immersive-vr'
          ? { ...model, vr: support[`${supported}`] }
          : { ...model, ar: support[`${supported}`] },
    }),
    ClickedEnter: ({ mode }) => ({
      model: { ...model, session: 'entering' },
      commands: [Enter({ mode })],
    }),
    ClickedExit: () => ({ model, commands: [Exit()] }),
    FailedEnter: () => ({ model: { ...model, session: 'none' } }),
    // The session's end arrives whoever ends it; what was detected goes with it.
    ChangedSession: ({ mode }) => ({
      model:
        mode === null
          ? { ...model, session: 'none', planes: [], meshes: [] }
          : { ...model, session: mode },
    }),
    ClickedFloor: ({ point }) => ({ model: planted(model, onFloor(point), model.kind) }),
    ChoseKind: ({ kind }) => ({ model: { ...model, kind } }),
    PlacedPlant: ({ at, kind }) => ({ model: planted(model, onFloor(at), kind) }),
    ClickedPlant: ({ id }) => ({
      model: modifyFields(model, { plants: (plants) => plants.filter((plant) => plant.id !== id) }),
    }),
    ClickedClear: () => ({ model: { ...model, plants: [] } }),
    SelectedSurface: ({ surface }) => ({ model: planted(model, surface.point, model.kind) }),
    DetectedPlanes: ({ detected }) => ({ model: { ...model, planes: detected.planes } }),
    DetectedMeshes: ({ detected }) => ({ model: { ...model, meshes: detected.meshes } }),
    Glided: ({ moved }) => ({
      model: modifyFields(model, { player: (player) => glided(player, moved) }),
    }),
    MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
