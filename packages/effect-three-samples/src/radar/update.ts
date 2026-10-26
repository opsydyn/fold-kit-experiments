import { type Camera, type Gesture, orbit, orbitOptions, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { ringIds, type Ring } from './data';
import type { RadarPosition } from './layout';
import { Message } from './message';
import {
  cameraDamping,
  cameraFacing,
  flightTo,
  universeCamera,
  homeCamera,
  idOfBlip,
  initialModel,
  isVisible,
  type Model,
  positionOf,
} from './model';
import { zoomedPosition, zoomLimits } from './space';

type AppReturn = Return<Model, Message>;

/** Look round the radar from outside its labels; it stays centred, so no panning. */
const orbitLimits = orbitOptions({
  minDistance: zoomLimits.min,
  maxDistance: zoomLimits.max,
  enablePan: false,
  // Never quite overhead or underneath, where the camera's up would be undefined.
  minPolarAngle: 0.05,
  maxPolarAngle: Math.PI - 0.05,
});

/** How far one Zoom button moves the camera towards or away from the centre. */
const zoomFactors = { in: 0.8, out: 1.25 } as const;

/** How far one Turn button turns the camera round the radar's axis. */
const turnStep = Math.PI / 6;

/** Drops a hover or a pin on an entry the filters now hide. */
const reconcile = (model: Model): Model => {
  const keepVisible = (id: Option.Option<string>) =>
    Option.filter(id, (current) => isVisible(model, current));
  return modifyFields(model, { hovered: keepVisible, selected: keepVisible });
};

/** Pins a blip, or unpins it when it is already pinned. */
const pin = (model: Model, id: string): Model => {
  const selected = Match.value(Option.contains(model.selected, id)).pipe(
    Match.when(true, () => Option.none<string>()),
    Match.orElse(() => Option.some(id)),
  );
  return { ...model, selected };
};

/** Pins an entry and flies the camera to it: a slow swoop round the radar to its blip. */
const flyTo = (model: Model, id: string): Model =>
  Option.match(
    Option.filter(positionOf(model, id), () => isVisible(model, id)),
    {
      onNone: () => model,
      onSome: (position: RadarPosition) => ({
        ...model,
        selected: Option.some(id),
        camera: flightTo(position),
      }),
    },
  );

/** Pins a list entry and turns the camera to face its blip, so the canvas is optional. */
const chooseEntry = (model: Model, id: string): Model =>
  Option.match(
    Option.filter(positionOf(model, id), () => isVisible(model, id)),
    {
      onNone: () => model,
      onSome: (position: RadarPosition) => ({
        ...model,
        selected: Option.some(id),
        camera: cameraFacing(position.longitude, 20),
      }),
    },
  );

/** Applies `apply` to the entry a blip's key names, while the filters show it. */
const withBlip = (key: string, model: Model, apply: (id: string) => Model): AppReturn => {
  const next = Option.match(
    Option.filter(idOfBlip(key), (id) => isVisible(model, id)),
    { onNone: () => model, onSome: apply },
  );
  return { model: next };
};

const toggleRing = (model: Model, ring: Ring): Model => {
  const enabled = model.enabledRings.includes(ring);
  const enabledRings = ringIds.filter((candidate) =>
    Match.value(candidate === ring).pipe(
      Match.when(true, () => !enabled),
      Match.orElse(() => model.enabledRings.includes(candidate)),
    ),
  );
  return reconcile({ ...model, enabledRings });
};

/** `point` turned `angle` radians about the vertical axis through the centre. */
const turnedAboutY = (point: Vec3, angle: number): Vec3 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [point[0] * cos + point[2] * sin, point[1], point[2] * cos - point[0] * sin];
};

const turned = (camera: Camera, direction: 'left' | 'right'): Camera => {
  const angle = Match.value(direction).pipe(
    Match.when('left', () => turnStep),
    Match.orElse(() => -turnStep),
  );
  return { ...camera, position: turnedAboutY(camera.position, angle) };
};

/** The stage's shape, as a gesture reports it; the last known one when it reports none. */
const aspectOf = (gesture: Gesture, fallback: number): number =>
  Option.getOrElse(
    Option.liftPredicate(
      gesture.width / gesture.height,
      (aspect) => Number.isFinite(aspect) && aspect > 0,
    ),
    () => fallback,
  );

/** Look round, unless the gesture began on a blip (a click on it pins it). */
const orbited = (model: Model, gesture: Gesture): Model =>
  Match.value('key' in gesture && gesture.key !== undefined).pipe(
    Match.when(true, () => model),
    // A gesture takes the camera back from a flight: brisk again, under the hand.
    Match.orElse(() => ({
      ...model,
      camera: { ...orbit(model.camera, gesture, orbitLimits), damping: cameraDamping.steady },
    })),
  );

export const init = (props: { readonly assetBase?: string } = {}) => ({
  model: initialModel(props.assetBase ?? '/models/'),
});

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    HoveredBlip: ({ key }) =>
      withBlip(key, model, (id) => modifyFields(model, { hovered: () => Option.some(id) })),
    LeftBlip: ({ key }) =>
      withBlip(key, model, (id) =>
        modifyFields(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => current !== id),
        }),
      ),
    ClickedBlip: ({ key }) => withBlip(key, model, (id) => pin(model, id)),
    DoubleClickedBlip: ({ key }) => withBlip(key, model, (id) => flyTo(model, id)),
    ClickedEmptySpace: () => ({ model: modifyFields(model, { selected: () => Option.none() }) }),
    ClickedEntry: ({ id }) => ({ model: chooseEntry(model, id) }),
    ClickedFlyTo: ({ id }) => ({ model: flyTo(model, id) }),
    ChangedQuery: ({ query }) => ({ model: reconcile({ ...model, query }) }),
    ChangedCategory: ({ category }) => ({ model: reconcile({ ...model, category }) }),
    ClickedRing: ({ ring }) => ({ model: toggleRing(model, ring) }),
    ClickedClearFilters: () => ({
      model: { ...model, query: '', category: 'all', enabledRings: ringIds },
    }),
    ClickedTurn: ({ direction }) => ({
      model: modifyFields(model, { camera: (camera) => turned(camera, direction) }),
    }),
    ClickedResetView: () => ({ model: { ...model, camera: homeCamera } }),
    ClickedUniverse: () => ({
      model: { ...model, camera: universeCamera(model.camera.position) },
    }),
    ClickedZoom: ({ direction }) => ({
      model: modifyFields(model, {
        camera: (camera) => ({
          ...camera,
          position: zoomedPosition(camera.position, zoomFactors[direction]),
        }),
      }),
    }),
    ClickedRelationships: () => ({
      model: modifyFields(model, { showRelationships: (shown) => !shown }),
    }),
    MadeGesture: ({ gesture }) => ({
      model: { ...orbited(model, gesture), stageAspect: aspectOf(gesture, model.stageAspect) },
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
