import { type Gesture, orbit, orbitOptions, perspectiveCamera } from '@opsydyn/effect-three';
import { Match, Record, Struct } from 'effect';

import type { Message } from './message';
import { homeCamera, initialModel, type Model, noteLimit, onWall } from './model';
import { plaques } from './plaques';

type AppReturn = { readonly model: Model };

/** The camera walked up to a plaque, three metres back from it, looking at it. */
const cameraAt = (degrees: number) =>
  perspectiveCamera({
    ...homeCamera,
    position: onWall(degrees, 1.8, 3.1),
    lookAt: onWall(degrees, 1.9, 0),
  });

/** Clicking the plaque in focus steps back; clicking another walks up to it. */
const focused = (model: Model, id: string): Model => {
  const plaque = plaques.find((candidate) => candidate.id === id);
  if (plaque === undefined || model.focus === id) {
    return { ...model, focus: null, camera: homeCamera };
  }
  return { ...model, focus: id, camera: cameraAt(plaque.degrees) };
};

const orbitLimits = orbitOptions({
  minDistance: 1.5,
  maxDistance: 7,
  minAzimuthAngle: -0.9,
  maxAzimuthAngle: 0.9,
  minPolarAngle: 1.1,
  maxPolarAngle: 1.75,
});

/** Look around, unless the gesture began on a plaque (a click on it walks up to it). */
const orbited = (model: Model, gesture: Gesture): Model =>
  'key' in gesture && gesture.key !== undefined
    ? model
    : { ...model, camera: orbit(model.camera, gesture, orbitLimits) };

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
});

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      ClickedPlaque: ({ id }) => ({ model: focused(model, id) }),
      ClickedAway: () => ({ model: { ...model, focus: null, camera: homeCamera } }),
      ToggledLights: () => ({ model: Struct.assign(model, { lit: !model.lit }) }),
      ChangedNote: ({ note }) => ({ model: { ...model, note: note.slice(0, noteLimit) } }),
      MeasuredLabel: ({ measured }) => ({
        model: { ...model, layouts: Record.set(model.layouts, measured.key, measured.block) },
      }),
      MadeGesture: ({ gesture }) => ({ model: orbited(model, gesture) }),
      ReceivedSceneLifecycle: ({ lifecycle }) => ({
        model: Struct.assign(model, {
          sceneFailure: lifecycle._tag === 'FailedScene' ? lifecycle.reason : null,
        }),
      }),
    }),
  );
