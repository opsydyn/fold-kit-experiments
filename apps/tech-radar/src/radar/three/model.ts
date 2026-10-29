import { Combobox, Tooltip } from '@foldkit/ui';
import { perspectiveCamera, SceneSchema, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option, Schema } from 'effect';

import {
  Category,
  categoryIds,
  type RadarData,
  type RadarDataset,
  type RadarRelationship,
  Ring,
  ringIds,
} from './data';
import {
  categoryCenter,
  filterPositions,
  layoutEntries,
  type RadarFilters,
  type RadarPosition,
} from './layout';
import { bearingOf, onSphere, shellRadius, zoomLimits } from './space';
import { summoned } from './summon';
import { ColorScheme, ContrastSetting, resolveTheme, type Theme, ThemeChoice } from './themes';
import type { Tour } from './tour';

export const CategoryFilter = Schema.Literals([...categoryIds, 'all']);
export type CategoryFilter = typeof CategoryFilter.Type;

/** The Monolith Easter egg: one slab, or shattered into microservices. */
export const MonolithState = Schema.Literals(['whole', 'shattered']);
export type MonolithState = typeof MonolithState.Type;

/**
 * How the reader points: with a mouse or pen that can hover, or a finger that cannot. A
 * finger's "hover" is its press, under the finger and gone as it lifts, so on touch a tap
 * is how you read.
 */
export const PointerInput = Schema.Literals(['hover', 'touch']);
export type PointerInput = typeof PointerInput.Type;

/** The sidebar's icon-only buttons: a tooltip names each on hover or keyboard focus. */
export const IconControl = Schema.Literals(['turn-left', 'turn-right', 'zoom-out', 'zoom-in']);
export type IconControl = typeof IconControl.Type;

/** Each icon button's tooltip, closed. */
const closedTooltips = {
  'turn-left': Tooltip.init({ id: 'radar-turn-left' }),
  'turn-right': Tooltip.init({ id: 'radar-turn-right' }),
  'zoom-out': Tooltip.init({ id: 'radar-zoom-out' }),
  'zoom-in': Tooltip.init({ id: 'radar-zoom-in' }),
} as const satisfies Readonly<Record<IconControl, Tooltip.Model>>;

/** A way out of the standalone radar, to a page of the host site. */
export const Link = Schema.Struct({ label: Schema.String, href: Schema.String });
export type Link = typeof Link.Type;

/**
 * Where an entry's full page is, as address templates: `{id}` for the entry, and in
 * `editionEntry`, `{edition}` for the date of an earlier edition.
 */
export const Pages = Schema.Struct({ entry: Schema.String, editionEntry: Schema.String });
export type Pages = typeof Pages.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  /** The radar's name, in the sidebar's header and the document's title. */
  title: Schema.String,
  /** The host page's links, shown in the sidebar's header. */
  links: Schema.Array(Link),
  /** Where each entry's full page is, when the host site has them. */
  pages: Schema.Option(Pages),
  /** The decoded dataset, `Ready` or `Failure` (see the type below). */
  data: Schema.Unknown,
  query: Schema.String,
  category: CategoryFilter,
  enabledRings: Schema.Array(Ring),
  hovered: Schema.Option(Schema.String),
  input: PointerInput,
  /** The theme the reader picked, or Auto; the one in force is `themeOf`. */
  themeChoice: ThemeChoice,
  /** The reader's colour scheme and contrast settings, which Auto follows. */
  colorScheme: ColorScheme,
  contrast: ContrastSetting,
  /** The scene key of the Easter egg under the pointer, if any. */
  hoveredEgg: Schema.Option(Schema.String),
  monolith: MonolithState,
  /** How many times a saucer has been hovered: each visit reads the next fallacy. */
  saucerVisits: Schema.Number,
  /** What became of the last Copy link, for the readout until the view next changes. */
  linkNotice: Schema.Option(Schema.Literals(['copied', 'refused'])),
  /** The flight recorder (see `Tour` in tour.ts). */
  tour: Schema.Unknown,
  /** What the recorder last has to say: a tour that would not load, say. */
  tourNotice: Schema.Option(Schema.String),
  /** The Konami code's invasion under way: milliseconds since it began. */
  invasion: Schema.Option(Schema.Number),
  /** The Kafka comet's clock, in milliseconds: where along its route it has got to. */
  cometClock: Schema.Number,
  /** Pinned by a click on a blip or a list entry, cleared by a click on empty space. */
  selected: Schema.Option(Schema.String),
  /** The category whose sector the camera last stopped at, for the breadcrumb. */
  cluster: Schema.Option(Category),
  /** A relay jump under way: the camera rides these waypoints to land at `to`. */
  journey: Schema.Option(
    Schema.Struct({
      to: Schema.String,
      waypoints: Schema.Array(Schema.Tuple([Schema.Number, Schema.Number, Schema.Number])),
      elapsed: Schema.Number,
    }),
  ),
  /** The reader prefers reduced motion: jumps land at once rather than ride. */
  reducedMotion: Schema.Boolean,
  /** Which edition the radar shows, oldest first; the last is the current one. */
  edition: Schema.Number,
  /** Whether the timeline is playing through the editions, and time into the current step. */
  playing: Schema.Boolean,
  playClock: Schema.Number,
  /** Whether the relationship edges are drawn. */
  showRelationships: Schema.Boolean,
  /** Whether the sidebar's entries table is open. */
  entriesOpen: Schema.Boolean,
  /** The search box: a Combobox whose input follows `query`. */
  search: Combobox.Model,
  /** The icon buttons' tooltips. */
  tooltips: Schema.Struct({
    'turn-left': Tooltip.Model,
    'turn-right': Tooltip.Model,
    'zoom-out': Tooltip.Model,
    'zoom-in': Tooltip.Model,
  }),
  /** The stage's width over its height, from the last gesture; square until then. */
  stageAspect: Schema.Number,
  camera: SceneSchema.Camera,
});
export type Model = Omit<typeof Model.Type, 'data' | 'tour'> &
  Readonly<{ data: RadarData; tour: Tour }>;

/** The camera's vertical field of view, in degrees. */
export const cameraFov = 40;

/** How far the camera stands from the centre: the outer shell and its labels fit. */
export const cameraDistance = 12;

/** The camera looking at the centre from `[longitude, latitude]`, as the 2D radar's view. */
export const cameraFacing = (longitude: number, latitude: number) =>
  perspectiveCamera({
    fov: cameraFov,
    position: onSphere(longitude, latitude, cameraDistance),
    lookAt: [0, 0, 0],
    damping: cameraDamping.steady,
  });

/**
 * How quickly the camera closes on where the Model puts it: briskly for orbits, turns and
 * zooms, slowly for a flight to a blip, so the camera swoops round the radar to it.
 */
export const cameraDamping = { steady: 0.08, flight: 0.035 } as const;

/**
 * The universe view: high above the radar on the camera's current bearing, the whole map
 * in sight. It stops just short of overhead, where a camera's up would be undefined.
 */
export const universeView = { elevation: 84, distance: 11 } as const;

export const universeCamera = (from: Vec3) =>
  perspectiveCamera({
    fov: cameraFov,
    position: onSphere(bearingOf(from), universeView.elevation, universeView.distance),
    lookAt: [0, 0, 0],
    damping: cameraDamping.flight,
  });

/**
 * A cluster stop: a category's sector seen from in front and a little above, close enough
 * that its nearer entries are named, far enough that the whole quarter is in view.
 */
export const clusterView = { elevation: 28, distance: 8 } as const;

export const clusterCamera = (category: Category) =>
  perspectiveCamera({
    fov: cameraFov,
    position: onSphere(categoryCenter(category)[0], clusterView.elevation, clusterView.distance),
    lookAt: [0, 0, 0],
    damping: cameraDamping.flight,
  });

/** Reads a category back from its name label's scene key. */
export const clusterOfLabel = (key: string): Option.Option<Category> =>
  Option.fromNullishOr(categoryIds.find((category) => key === `label:category:${category}`));

/** How far from a blip a flight stops: close enough for its moons and description. */
export const flightApproach = 3.4;

/**
 * A flight's vantage: on the blip's side of the radar and a little above it, still looking
 * at the centre, so the blip sits near the middle of the view with the radar behind it.
 * It stays within the zoom limits, so orbiting and zooming carry on from there.
 */
export const flightTo = (position: RadarPosition) =>
  perspectiveCamera({
    fov: cameraFov,
    position: onSphere(
      position.longitude,
      position.latitude + 10,
      Math.max(zoomLimits.min, shellRadius(position.entry.ring) + flightApproach),
    ),
    lookAt: [0, 0, 0],
    damping: cameraDamping.flight,
  });

/** The 2D radar's home view: longitude 0, 20° above the equator. */
export const homeCamera = cameraFacing(0, 20);

/** What the radar keeps of its host page: its assets, name, links out and full pages. */
export type Host = Readonly<{
  assetBase: string;
  title: string;
  links: ReadonlyArray<Link>;
  pages: Option.Option<Pages>;
}>;

export const initialModel = (host: Host, data: RadarData): Model => ({
  assetBase: host.assetBase,
  title: host.title,
  links: host.links,
  pages: host.pages,
  data,
  query: '',
  category: 'all',
  enabledRings: ringIds,
  hovered: Option.none(),
  input: 'hover',
  themeChoice: 'auto',
  colorScheme: 'dark',
  contrast: 'standard',
  hoveredEgg: Option.none(),
  monolith: 'whole',
  saucerVisits: 0,
  linkNotice: Option.none(),
  tour: { _tag: 'Idle' },
  tourNotice: Option.none(),
  invasion: Option.none(),
  cometClock: 0,
  selected: Option.none(),
  cluster: Option.none(),
  journey: Option.none(),
  reducedMotion: false,
  edition: editionsIn(data).length - 1,
  playing: false,
  playClock: 0,
  showRelationships: true,
  entriesOpen: false,
  search: Combobox.init({ id: 'radar-search' }),
  tooltips: closedTooltips,
  stageAspect: 1,
  camera: homeCamera,
});

/** The theme in force: the reader's choice, or what their settings ask for. */
export const themeOf = (model: Model): Theme =>
  resolveTheme(model.themeChoice, { scheme: model.colorScheme, contrast: model.contrast });

/** The host page the radar is on, as its Model holds it. */
export const hostOf = (model: Model): Host => ({
  assetBase: model.assetBase,
  title: model.title,
  links: model.links,
  pages: model.pages,
});

/** What the host page hands the radar: its data, where its assets live and its links out. */
export type RadarProps = Readonly<{
  dataset: RadarDataset;
  title?: string;
  assetBase?: string;
  links?: ReadonlyArray<Link>;
  /** Where each entry's full page is; without them, the card has no full-page link. */
  pages?: Pages;
  /** The page's query parameters: a deep link to open on. */
  link?: Readonly<Record<string, string>>;
}>;

/** The filters in force. A magic word summons an Easter egg and filters nothing. */
const filterQuery = (query: string): string =>
  Option.match(summoned(query), { onNone: () => query, onSome: () => '' });

export const filtersOf = (model: Model): RadarFilters => ({
  query: filterQuery(model.query),
  category: model.category,
  rings: model.enabledRings,
});

/** One edition of the radar: when, its name, the rings that differed then, who was absent. */
export type Edition = Readonly<{
  authoredOn: string;
  label: string;
  rings: Readonly<Record<string, Ring>>;
  absent: ReadonlyArray<string>;
}>;

/** Every edition of a dataset, oldest first, ending with the current one. */
export const editionsIn = (data: RadarData): ReadonlyArray<Edition> =>
  Match.value(data).pipe(
    Match.tag('Ready', ({ dataset }) => [
      ...(dataset.editions ?? []),
      { authoredOn: dataset.authoredOn, label: 'Current edition', rings: {}, absent: [] },
    ]),
    Match.orElse(() => []),
  );

export const editionsOf = (model: Model): ReadonlyArray<Edition> => editionsIn(model.data);

/** The edition the radar shows; the current one if the index is out of range. */
export const editionOf = (model: Model): Edition =>
  editionsOf(model)[model.edition] ?? {
    authoredOn: '',
    label: 'Current edition',
    rings: {},
    absent: [],
  };

/**
 * The address of an entry's full page, as it stood in the edition shown: an earlier
 * edition's page while time-travelled to one the entry was on, its current page otherwise.
 */
export const fullPageOf = (model: Model, id: string): Option.Option<string> =>
  Option.map(model.pages, (pages) => {
    const editions = editionsOf(model);
    const earlier = model.edition < editions.length - 1 ? editionOf(model) : undefined;
    return earlier === undefined || earlier.absent.includes(id)
      ? pages.entry.replaceAll('{id}', id)
      : pages.editionEntry.replaceAll('{edition}', earlier.authoredOn).replaceAll('{id}', id);
  });

/**
 * Every entry's slot, in the ring it held in the shown edition, whether or not the
 * filters show it. Slots never move between editions, so a blip only changes shell.
 */
export const positionsOf = (model: Model): ReadonlyArray<RadarPosition> => {
  const { rings } = editionOf(model);
  return Match.value(model.data).pipe(
    Match.tag('Ready', ({ dataset }) =>
      layoutEntries(dataset.entries).map((position) => ({
        ...position,
        entry: { ...position.entry, ring: rings[position.entry.id] ?? position.entry.ring },
      })),
    ),
    Match.orElse(() => []),
  );
};

/** The entries on the radar in the shown edition, filtered or not. */
export const presentOf = (model: Model): ReadonlyArray<RadarPosition> => {
  const absent = new Set(editionOf(model).absent);
  return positionsOf(model).filter(({ entry }) => !absent.has(entry.id));
};

/** The entries the filters show, of those on the radar in the shown edition. */
export const visibleOf = (model: Model): ReadonlyArray<RadarPosition> =>
  filterPositions(presentOf(model), filtersOf(model));

export const isVisible = (model: Model, id: string): boolean =>
  visibleOf(model).some(({ entry }) => entry.id === id);

export const positionOf = (model: Model, id: string): Option.Option<RadarPosition> =>
  Option.fromNullishOr(positionsOf(model).find(({ entry }) => entry.id === id));

/** A blip's scene key: entry ids are unique, so its keys are. */
export const blipKey = (id: string): string => `blip:${id}`;

/**
 * Reads an entry id back from the scene key of a blip or any of its parts (its body,
 * ring or moons, keyed `blip:<id>:…`); entry ids never contain a colon.
 */
export const idOfBlip = (key: string): Option.Option<string> =>
  Option.fromNullishOr(/^blip:([^:]+)(?::|$)/.exec(key)?.[1]);

/** Every relationship in the dataset. */
export const relationshipsOf = (model: Model): ReadonlyArray<RadarRelationship> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', ({ dataset }) => dataset.relationships ?? []),
    Match.orElse(() => []),
  );

/** The relationships drawn: while edges are on, those whose two entries both show. */
export const visibleRelationships = (model: Model): ReadonlyArray<RadarRelationship> =>
  relationshipsOf(model).filter(
    ({ from, to }) => model.showRelationships && isVisible(model, from) && isVisible(model, to),
  );
