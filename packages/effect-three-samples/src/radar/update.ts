import { type Camera, type Gesture, orbit, orbitOptions, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { advanceComet } from './comet';
import { CopyLink, LoadThemeChoice, ReplaceLink, SaveThemeChoice } from './command';
import { ringIds, type Ring } from './data';
import { idOfSaucer } from './easter';
import { advanceInvasion } from './invaders';
import type { RadarPosition } from './layout';
import { decodeLink, type DeepLink, linkOf, type Standpoint } from './link';
import { Message } from './message';
import {
  cameraDamping,
  cameraFacing,
  editionsOf,
  clusterCamera,
  flightTo,
  universeCamera,
  homeCamera,
  idOfBlip,
  initialModel,
  isVisible,
  type Model,
  type MonolithState,
  positionOf,
  type RadarProps,
} from './model';
import { alongPath, easeInOut, relayDamping, relayDuration, relayWaypoints } from './relay';
import { zoomedPosition, zoomLimits } from './space';
import { summonedMonolith } from './summon';
import { playStep } from './timeline';

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

const lastEdition = (model: Model): number => Math.max(0, editionsOf(model).length - 1);

const clampEdition = (model: Model, index: number): number =>
  Math.min(lastEdition(model), Math.max(0, Math.round(index)));

/** Plays from where the timeline is, or from the first edition if it is at the last; or pauses. */
const togglePlay = (model: Model): Model =>
  Match.value({ playing: model.playing, atEnd: model.edition >= lastEdition(model) }).pipe(
    Match.when({ playing: true }, () => ({ ...model, playing: false, playClock: 0 })),
    Match.when({ atEnd: true }, () =>
      reconcile({ ...model, edition: 0, playing: true, playClock: 0 }),
    ),
    Match.orElse(() => ({ ...model, playing: true, playClock: 0 })),
  );

/** One frame of playback: after each step the next edition shows, stopping at the last. */
const advancePlayback = (model: Model, deltaTimeMs: number): Model => {
  const playClock = model.playClock + deltaTimeMs;
  const next = Math.min(lastEdition(model), model.edition + 1);
  return Match.value(playClock >= playStep).pipe(
    Match.when(true, () =>
      reconcile({
        ...model,
        edition: next,
        playClock: 0,
        playing: next < lastEdition(model),
      }),
    ),
    Match.orElse(() => ({ ...model, playClock })),
  );
};

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

/** The edition a link names by its date, if this radar has one of that date. */
const editionIndex = (model: Model, link: DeepLink): Option.Option<number> =>
  Option.flatMap(link.edition, (date) =>
    Option.liftPredicate(
      editionsOf(model).findIndex(({ authoredOn }) => authoredOn === date),
      (index) => index >= 0,
    ),
  );

/**
 * Opens the radar where a deep link says: its theme, edition and filters, then its pin,
 * then where the camera stands. Parts that name nothing in this radar (an entry it lacks,
 * an edition it never had) are let go.
 */
export const applyLink = (model: Model, link: DeepLink): Model => {
  const edition = Option.getOrElse(editionIndex(model, link), () => model.edition);
  const themeChoice = Option.getOrElse(link.theme, () => model.themeChoice);
  const query = Option.getOrElse(link.query, () => model.query);
  const category = Option.getOrElse(link.category, () => model.category);
  const enabledRings = Option.getOrElse(link.rings, () => model.enabledRings);
  const set: Model = reconcile({
    ...model,
    themeChoice,
    edition,
    query,
    category,
    enabledRings,
    showRelationships: Option.isNone(link.edges) && model.showRelationships,
  });
  const pinned = Option.match(
    Option.filter(link.entry, (id) => isVisible(set, id)),
    {
      onNone: () => set,
      onSome: (id) => ({
        ...set,
        selected: Option.some(id),
        cluster: Option.map(positionOf(set, id), ({ entry }) => entry.category),
      }),
    },
  );
  return Option.match(link.standpoint, {
    onNone: () => pinned,
    onSome: (standpoint) => standAt(pinned, standpoint),
  });
};

/** The camera at a link's standpoint; an entry standpoint needs its entry pinned. */
const standAt = (model: Model, standpoint: Standpoint): Model =>
  Match.value(standpoint).pipe(
    Match.tag('Universe', () => ({
      ...model,
      cluster: Option.none(),
      camera: universeCamera(model.camera.position),
    })),
    Match.tag('Cluster', ({ category }) => ({
      ...model,
      cluster: Option.some(category),
      camera: clusterCamera(category),
    })),
    Match.tag('Entry', () =>
      Option.match(model.selected, { onNone: () => model, onSome: (id) => flyTo(model, id) }),
    ),
    Match.exhaustive,
  );

/**
 * The radar as it opens, at the page's deep link if it has one, and a look for the theme
 * the reader picked last time, unless the link names a theme for this visit.
 */
export const init = (props: RadarProps = {}): AppReturn => {
  const link = decodeLink(props.link ?? {});
  const model = applyLink(
    initialModel(props.assetBase ?? '/models/', undefined, props.links ?? []),
    link,
  );
  const commands = Option.match(link.theme, {
    onNone: () => [LoadThemeChoice()],
    onSome: () => [],
  });
  return { model, commands };
};

/**
 * A step only a hovering pointer takes. A finger's "hover" is its press, so on touch the
 * blip under it is read by the tap that pins it instead.
 */
const hovering = (model: Model, step: () => AppReturn): AppReturn =>
  Match.value(model.input).pipe(
    Match.when('touch', () => ({ model })),
    Match.orElse(step),
  );

/**
 * The pointer reaches an egg: it speaks. A saucer reached afresh reads its next fallacy;
 * the tap that follows a finger's press is the same visit, not another.
 */
const visitEgg = (model: Model, key: string): Model => {
  const afresh = !Option.contains(model.hoveredEgg, key) && Option.isSome(idOfSaucer(key));
  return {
    ...model,
    hoveredEgg: Option.some(key),
    saucerVisits: model.saucerVisits + Number(afresh),
  };
};

/** A click on the Monolith shatters it into microservices, and puts them back again. */
const decomposed = {
  whole: 'shattered',
  shattered: 'whole',
} as const satisfies Readonly<Record<MonolithState, MonolithState>>;

const step = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    HoveredBlip: ({ key }) =>
      hovering(model, () =>
        withBlip(key, model, (id) => modifyFields(model, { hovered: () => Option.some(id) })),
      ),
    LeftBlip: ({ key }) =>
      hovering(model, () =>
        withBlip(key, model, (id) =>
          modifyFields(model, {
            hovered: (hovered) => Option.filter(hovered, (current) => current !== id),
          }),
        ),
      ),
    ClickedBlip: ({ key }) => withBlip(key, model, (id) => pin(model, id)),
    DoubleClickedBlip: ({ key }) => withBlip(key, model, (id) => flyTo(model, id)),
    ClickedEmptySpace: () => ({
      model: modifyFields(model, {
        selected: () => Option.none(),
        hoveredEgg: () => Option.none(),
      }),
    }),
    ClickedEntry: ({ id }) => ({ model: chooseEntry(model, id) }),
    ClickedFlyTo: ({ id }) => ({ model: flyTo(model, id) }),
    ChangedQuery: ({ query }) => ({
      model: reconcile({
        ...model,
        query,
        monolith: Option.getOrElse(summonedMonolith(query), () => model.monolith),
      }),
    }),
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
    ChangedEdition: ({ index }) => ({
      model: reconcile({
        ...model,
        edition: clampEdition(model, index),
        playing: false,
        playClock: 0,
      }),
    }),
    ClickedPlay: () => ({ model: togglePlay(model) }),
    AdvancedPlayback: ({ deltaTimeMs }) => ({ model: advancePlayback(model, deltaTimeMs) }),
    HoveredEgg: ({ key }) => ({ model: visitEgg(model, key) }),
    // On touch an egg keeps speaking after the finger lifts, until a tap elsewhere.
    LeftEgg: ({ key }) =>
      hovering(model, () => ({
        model: modifyFields(model, {
          hoveredEgg: (hovered) => Option.filter(hovered, (current) => current !== key),
        }),
      })),
    ChangedColorScheme: ({ scheme }) => ({ model: { ...model, colorScheme: scheme } }),
    ChangedContrast: ({ contrast }) => ({ model: { ...model, contrast } }),
    ChoseTheme: ({ choice }) => ({
      model: { ...model, themeChoice: choice },
      commands: [SaveThemeChoice({ choice })],
    }),
    SucceededLoadThemeChoice: ({ choice }) => ({ model: { ...model, themeChoice: choice } }),
    CompletedSaveThemeChoice: () => ({ model }),
    ChangedPointerInput: ({ input }) => ({
      model: { ...model, input, hovered: Option.none(), hoveredEgg: Option.none() },
    }),
    EnteredKonamiCode: () => ({ model: { ...model, invasion: Option.some(0) } }),
    AdvancedInvasion: ({ deltaTimeMs }) => ({ model: advanceInvasion(model, deltaTimeMs) }),
    AdvancedComet: ({ deltaTimeMs }) => ({ model: advanceComet(model, deltaTimeMs) }),
    ClickedMonolith: () => ({ model: { ...model, monolith: decomposed[model.monolith] } }),
    CompletedReplaceLink: () => ({ model }),
    ClickedCopyLink: () => ({ model, commands: [CopyLink()] }),
    CompletedCopyLink: ({ outcome }) => ({ model: { ...model, linkNotice: Option.some(outcome) } }),
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

/**
 * Keeps the address bar on the view: when a step changes the link, the URL is rewritten
 * to it, and a "Link copied" notice, now out of date, goes.
 */
const withLink = (before: Model, result: AppReturn): AppReturn => {
  const link = linkOf(result.model);
  return Match.value(link === linkOf(before)).pipe(
    Match.when(true, () => result),
    Match.orElse(() => ({
      model: { ...result.model, linkNotice: Option.none() },
      commands: [...(result.commands ?? []), ReplaceLink({ query: link })],
    })),
  );
};

export const update = (model: Model, message: Message): AppReturn =>
  withLink(
    model,
    step(
      Match.value(endsJourney.has(message._tag) && Option.isSome(model.journey)).pipe(
        Match.when(true, () => ({ ...model, journey: Option.none() })),
        Match.orElse(() => model),
      ),
      message,
    ),
  );
