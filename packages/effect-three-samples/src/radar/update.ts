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
  clusterCamera,
  flightTo,
  universeCamera,
  homeCamera,
  idOfBlip,
  initialModel,
  isVisible,
  type Model,
  positionOf,
} from './model';
import { alongPath, easeInOut, relayDamping, relayDuration, relayWaypoints } from './relay';
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
        cluster: Option.some(position.entry.category),
        camera: flightTo(position),
      }),
    },
  );

/**
 * Follows a relationship from the pinned entry: the camera rides the edge's arc to the
 * entry at its other end, which is pinned from the start so the edge it rides lights up.
 * With nothing pinned, or under reduced motion, it flies there directly instead.
 */
const relayTo = (model: Model, to: string): Model => {
  const ride = Option.all([
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    Option.filter(positionOf(model, to), () => isVisible(model, to)),
  ]).pipe(Option.filter(() => !model.reducedMotion));
  return Option.match(ride, {
    onNone: () => flyTo(model, to),
    onSome: ([from, target]) => ({
      ...model,
      selected: Option.some(to),
      cluster: Option.some(target.entry.category),
      journey: Option.some({ to, waypoints: relayWaypoints(from, target), elapsed: 0 }),
    }),
  });
};

type Journey = Option.Option.Value<Model['journey']>;

/** One frame of a ride: the camera moves along it, then lands as a flight would. */
function ride(model: Model, journey: Journey, deltaTimeMs: number): Model {
  const elapsed = journey.elapsed + deltaTimeMs;
  const progress = Math.min(1, elapsed / relayDuration);
  const riding: Model = {
    ...model,
    journey: Option.some({ ...journey, elapsed }),
    camera: {
      ...model.camera,
      position: alongPath(journey.waypoints, easeInOut(progress)),
      lookAt: [0, 0, 0],
      damping: relayDamping,
    },
  };
  return Match.value(progress >= 1).pipe(
    Match.when(true, () => ({ ...flyTo(model, journey.to), journey: Option.none() })),
    Match.orElse(() => riding),
  );
}

/** One frame of a relay jump, if one is under way. */
const advanceRelay = (model: Model, deltaTimeMs: number): Model =>
  Option.match(model.journey, {
    onNone: () => model,
    onSome: (journey) => ride(model, journey, deltaTimeMs),
  });

/** Pins a list entry and turns the camera to face its blip, so the canvas is optional. */
const chooseEntry = (model: Model, id: string): Model =>
  Option.match(
    Option.filter(positionOf(model, id), () => isVisible(model, id)),
    {
      onNone: () => model,
      onSome: (position: RadarPosition) => ({
        ...model,
        selected: Option.some(id),
        cluster: Option.some(position.entry.category),
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

const step = (model: Model, message: Message): AppReturn =>
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
    ClickedResetView: () => ({ model: { ...model, cluster: Option.none(), camera: homeCamera } }),
    ClickedUniverse: () => ({
      model: { ...model, cluster: Option.none(), camera: universeCamera(model.camera.position) },
    }),
    ClickedCluster: ({ category }) => ({
      model: { ...model, cluster: Option.some(category), camera: clusterCamera(category) },
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
    ClickedRelay: ({ to }) => ({ model: relayTo(model, to) }),
    AdvancedRelay: ({ deltaTimeMs }) => ({ model: advanceRelay(model, deltaTimeMs) }),
    ChangedReducedMotion: ({ isReducedMotion }) => ({
      model: { ...model, reducedMotion: isReducedMotion },
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });

/** Anything that moves the camera itself ends a relay jump under way: the ride is skippable. */
const endsJourney: ReadonlySet<Message['_tag']> = new Set([
  'MadeGesture',
  'ClickedTurn',
  'ClickedZoom',
  'ClickedResetView',
  'ClickedUniverse',
  'ClickedCluster',
  'ClickedFlyTo',
  'DoubleClickedBlip',
  'ClickedEntry',
  'ClickedRelay',
]);

export const update = (model: Model, message: Message): AppReturn =>
  step(
    Match.value(endsJourney.has(message._tag) && Option.isSome(model.journey)).pipe(
      Match.when(true, () => ({ ...model, journey: Option.none() })),
      Match.orElse(() => model),
    ),
    message,
  );
