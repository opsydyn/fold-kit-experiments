import { Combobox, Tooltip } from '@foldkit/ui';
import { type Camera, type Gesture, orbit, orbitOptions, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import { foldChild, foldChildAt, type Return } from 'foldkit/update';

import { advanceComet } from './comet';
import {
  CopyLink,
  LoadThemeChoice,
  LoadTour,
  LoadTypeface,
  ReplaceLink,
  SaveThemeChoice,
  SaveTour,
  SaveTypeface,
} from './command';
import { decodeRadarDataset, ringIds, type Ring } from './data';
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
  hostOf,
  type IconControl,
  initialModel,
  isVisible,
  type Model,
  type MonolithState,
  positionOf,
  type RadarProps,
} from './model';
import { alongPath, easeInOut, relayDamping, relayDuration, relayWaypoints } from './relay';
import { searchBox, searchMove, withSearchText } from './search';
import { zoomedPosition, zoomLimits } from './space';
import { summonedMonolith } from './summon';
import { playStep } from './timeline';
import {
  captionOf,
  idleTour,
  isRecordable,
  leadIn,
  paceOf,
  recorded,
  type Recording,
  type Tour,
} from './tour';

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

/**
 * An icon button's tooltip: its own update runs, the next tooltip is written back and its
 * delay and anchor Commands come back as the radar's. Showing and hiding change nothing
 * else.
 */
const foldTooltip = foldChildAt({
  update: Tooltip.update,
  readAt: (model: Model, control: IconControl) => Option.some(model.tooltips[control]),
  writeAt: (model, control, next) =>
    modifyFields(model, { tooltips: (tooltips) => ({ ...tooltips, [control]: next }) }),
  toParentMessage: (control, message) => Message.GotTooltipMessage({ control, message }),
  foldOutMessage: () => () => (model) => ({ model }),
});

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

/** A search for `query`: it filters the radar, and opens the entries table to list them. */
const withQuery = (model: Model, query: string): Model =>
  reconcile({
    ...model,
    query,
    entriesOpen: model.entriesOpen || query.trim() !== '',
    monolith: Option.getOrElse(summonedMonolith(query), () => model.monolith),
  });

/**
 * The search box: its own update runs, and picking an entry pins it and faces it, as a row
 * of the entries table does.
 */
const pickedFromSearch =
  (outMessage: Combobox.OutMessage<string>) =>
  (model: Model): AppReturn =>
    Match.value(outMessage).pipe(
      Match.tag('Selected', ({ value }) => ({ model: chooseEntry(model, value) })),
      Match.orElse(() => ({ model })),
    );

const readSearch = (model: Model) => Option.some(model.search);

const foldSearch = foldChild({
  update: searchBox.update,
  read: readSearch,
  write: (model, search) => ({ ...model, search }),
  toParentMessage: (message) => Message.GotSearchMessage({ message }),
  foldOutMessage: pickedFromSearch,
});

/** A search box Message: its own step, and typing is a search, as it always was. */
const searchStep = (model: Model, message: Combobox.Message): AppReturn => {
  const result = foldSearch(model, message);
  return Match.value(message).pipe(
    Match.tag('UpdatedInputValue', ({ value }) => ({
      ...result,
      model: withQuery(result.model, value),
    })),
    Match.orElse(() => result),
  );
};

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
 * the reader picked last time, unless the link names a theme for this visit, and for the
 * typeface they picked last, here or on a full page.
 */
export const init = (props: RadarProps): AppReturn => {
  const link = decodeLink(props.link ?? {});
  const model = applyLink(
    initialModel(
      {
        assetBase: props.assetBase ?? '/models/',
        title: props.title ?? 'Tech radar',
        links: props.links ?? [],
        pages: Option.fromNullishOr(props.pages),
        labelFonts: props.labelFonts ?? {},
      },
      decodeRadarDataset(props.dataset),
    ),
    link,
  );
  const commands = [
    ...Option.match(link.theme, { onNone: () => [LoadThemeChoice()], onSome: () => [] }),
    LoadTypeface(),
  ];
  return { model: withSearchText(model), commands };
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
    ChangedQuery: ({ query }) => ({ model: withQuery(model, query) }),
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
    ToggledEntries: ({ isOpen }) => ({ model: { ...model, entriesOpen: isOpen } }),
    GotTooltipMessage: ({ control, message }) => foldTooltip(model, control, message),
    GotSearchMessage: ({ message }) => searchStep(model, message),
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
    ChoseTypeface: ({ typeface }) => ({
      model: { ...model, typeface },
      commands: [SaveTypeface({ typeface })],
    }),
    SucceededLoadTypeface: ({ typeface }) => ({ model: { ...model, typeface } }),
    CompletedSaveTypeface: () => ({ model }),
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
    ClickedRecord: () => ({
      model: {
        ...model,
        tour: { _tag: 'Recording', recording: { start: linkOf(model), steps: [] } },
        tourNotice: Option.none(),
      },
    }),
    ClickedStopRecording: () => ({ model: { ...model, tour: stoppedRecording(model.tour) } }),
    ClickedPlayTour: () => ({ model: startTour(model) }),
    ClickedStopTour: () => ({ model: { ...model, tour: stoppedTour(model.tour) } }),
    AdvancedTour: ({ deltaTimeMs }) => advanceTour(model, deltaTimeMs),
    ClickedSaveTour: () => ({ model, commands: saveCommands(model) }),
    CompletedSaveTour: () => ({ model }),
    ClickedLoadTour: () => ({ model, commands: [LoadTour()] }),
    SucceededLoadTour: ({ recording }) => ({
      model: {
        ...model,
        // SAFETY: LoadTour decodes the file against the tour schema before sending this.
        tour: { _tag: 'Ready', recording: recording as Recording },
        tourNotice: Option.some('Tour loaded: press Play to watch it'),
      },
    }),
    FailedLoadTour: ({ reason }) => ({ model: { ...model, tourNotice: Option.some(reason) } }),
    CancelledLoadTour: () => ({ model }),
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

/** The recording a tour holds, if any. */
const recordingOf = (tour: Tour): Option.Option<Recording> =>
  Match.value(tour).pipe(
    Match.tag('Idle', () => Option.none<Recording>()),
    Match.orElse(({ recording }) => Option.some(recording)),
  );

/** Saving a tour: a file of the recording held, if there is one. */
const saveCommands = (model: Model) =>
  Option.match(recordingOf(model.tour), {
    onNone: () => [],
    onSome: (recording) => [SaveTour({ recording })],
  });

/** A finished recording ready to play, unless nothing was recorded. */
const readyOrIdle = (recording: Recording): Tour =>
  Match.value(recording.steps.length).pipe(
    Match.when(0, (): Tour => idleTour),
    Match.orElse((): Tour => ({ _tag: 'Ready', recording })),
  );

/** Recording stops: what was recorded is ready to play, unless nothing was. */
const stoppedRecording = (tour: Tour): Tour =>
  Match.value(tour).pipe(
    Match.tag('Recording', ({ recording }) => readyOrIdle(recording)),
    Match.orElse(() => tour),
  );

/** A tour stops: its recording stays, ready to play again. */
const stoppedTour = (tour: Tour): Tour =>
  Match.value(tour).pipe(
    Match.tag('Playing', ({ recording }): Tour => ({ _tag: 'Ready', recording })),
    Match.orElse(() => tour),
  );

/**
 * The radar a tour starts from: the view as the radar opens, kept to the reader's own
 * settings (input, theme, contrast, motion, stage), then the recording's start link.
 */
const tourStart = (model: Model, recording: Recording): Model =>
  applyLink(
    {
      ...initialModel(hostOf(model), model.data),
      input: model.input,
      themeChoice: model.themeChoice,
      colorScheme: model.colorScheme,
      contrast: model.contrast,
      reducedMotion: model.reducedMotion,
      stageAspect: model.stageAspect,
    },
    decodeLink(Object.fromEntries(new URLSearchParams(recording.start))),
  );

/** Play: back to where the recording began, the first move a moment later. */
const startTour = (model: Model): Model =>
  Option.match(recordingOf(model.tour), {
    onNone: () => model,
    onSome: (recording) => ({
      ...tourStart(model, recording),
      tour: { _tag: 'Playing', recording, next: 0, wait: leadIn, caption: 'The tour begins' },
    }),
  });

/**
 * A move as a tour replays it. A theme picked on the tour shows without being saved over
 * the reader's own choice.
 */
const replayed = (message: Message): Message =>
  Match.value(message).pipe(
    Match.tag('ChoseTheme', ({ choice }) => Message.SucceededLoadThemeChoice({ choice })),
    Match.orElse(() => message),
  );

type Playing = Extract<Tour, { _tag: 'Playing' }>;

/** The next move of a tour, made through `update` as if the reader had made it. */
const playNext = (model: Model, playing: Playing): AppReturn =>
  Option.match(Option.fromNullishOr(playing.recording.steps[playing.next]), {
    onNone: () => ({ model: { ...model, tour: { _tag: 'Ready', recording: playing.recording } } }),
    onSome: (move) => {
      const result = update({ ...model, tour: idleTour }, replayed(move));
      return {
        ...result,
        model: {
          ...result.model,
          tour: {
            ...playing,
            next: playing.next + 1,
            wait: paceOf(result.model, move),
            caption: captionOf(model, move),
          },
        },
      };
    },
  });

/** Waiting out a move: the next is made once its wait has run down. */
const waitOut = (model: Model, playing: Playing, deltaTimeMs: number): AppReturn => {
  const left = playing.wait - deltaTimeMs;
  return Match.value(left > 0).pipe(
    Match.when(true, (): AppReturn => ({ model: { ...model, tour: { ...playing, wait: left } } })),
    Match.orElse(() => playNext(model, playing)),
  );
};

/** One frame of a tour: it waits out the current move, then makes the next. */
const advanceTour = (model: Model, deltaTimeMs: number): AppReturn =>
  Match.value(model.tour).pipe(
    Match.tag('Playing', (playing) => waitOut(model, playing, deltaTimeMs)),
    Match.orElse((): AppReturn => ({ model })),
  );

/**
 * The move a Message makes, as a tour records it: most are their own move, and the search
 * box's typing and picking are the search and the pick they make.
 */
const moveOf = (message: Message): Option.Option<Message> =>
  Match.value(message).pipe(
    Match.tag('GotSearchMessage', ({ message: search }) => searchMove(search)),
    Match.orElse(() => Option.liftPredicate(message, isRecordable)),
  );

/** The reader's own move during a tour ends it: the reader has taken the controls. */
const interrupting = (model: Model, message: Message): Model =>
  Match.value(model.tour).pipe(
    Match.tag('Playing', () =>
      Option.match(moveOf(message), {
        onNone: () => model,
        onSome: () => ({ ...model, tour: stoppedTour(model.tour) }),
      }),
    ),
    Match.orElse(() => model),
  );

type Recorder = Extract<Tour, { _tag: 'Recording' }>;

/** One of the reader's moves added to the recording under way. */
const withMove = (result: AppReturn, tour: Recorder, message: Message): AppReturn =>
  Option.match(moveOf(message), {
    onNone: () => result,
    onSome: (move) => ({
      ...result,
      model: { ...result.model, tour: { ...tour, recording: recorded(tour.recording, move) } },
    }),
  });

/** While recording, each of the reader's moves joins the recording. */
const recording = (result: AppReturn, message: Message): AppReturn =>
  Match.value(result.model.tour).pipe(
    Match.tag('Recording', (tour) => withMove(result, tour, message)),
    Match.orElse(() => result),
  );

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

export const update = (model: Model, message: Message): AppReturn => {
  const ready = interrupting(
    Match.value(endsJourney.has(message._tag) && Option.isSome(model.journey)).pipe(
      Match.when(true, () => ({ ...model, journey: Option.none() })),
      Match.orElse(() => model),
    ),
    message,
  );
  const result = recording(step(ready, message), message);
  // However the query changed (typing, a tour, a link, Clear filters), the search box shows it.
  return withLink(model, { ...result, model: withSearchText(result.model) });
};
