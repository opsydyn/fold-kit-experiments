import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import { Match, Option, Schema } from 'effect';

import { categoryIds, loadDemoRadar, Ring, ringIds, type RadarData } from './data';
import { filterPositions, layoutEntries, type RadarFilters, type RadarPosition } from './layout';
import { onSphere } from './space';

export const CategoryFilter = Schema.Literals([...categoryIds, 'all']);
export type CategoryFilter = typeof CategoryFilter.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  /** The decoded dataset, `Ready` or `Failure` (see the type below). */
  data: Schema.Unknown,
  query: Schema.String,
  category: CategoryFilter,
  enabledRings: Schema.Array(Ring),
  hovered: Schema.Option(Schema.String),
  /** Pinned by a click on a blip or a list entry, cleared by a click on empty space. */
  selected: Schema.Option(Schema.String),
  camera: SceneSchema.Camera,
});
export type Model = Omit<typeof Model.Type, 'data'> & Readonly<{ data: RadarData }>;

/** How far the camera stands from the centre: the outer shell and its labels fit. */
export const cameraDistance = 12;

/** The camera looking at the centre from `[longitude, latitude]`, as the 2D radar's view. */
export const cameraFacing = (longitude: number, latitude: number) =>
  perspectiveCamera({
    fov: 40,
    position: onSphere(longitude, latitude, cameraDistance),
    lookAt: [0, 0, 0],
    damping: 0.08,
  });

/** The 2D radar's home view: longitude 0, 20° above the equator. */
export const homeCamera = cameraFacing(0, 20);

export const initialModel = (assetBase: string, data: RadarData = loadDemoRadar()): Model => ({
  assetBase,
  data,
  query: '',
  category: 'all',
  enabledRings: ringIds,
  hovered: Option.none(),
  selected: Option.none(),
  camera: homeCamera,
});

export const filtersOf = (model: Model): RadarFilters => ({
  query: model.query,
  category: model.category,
  rings: model.enabledRings,
});

/** Every entry's slot, whether or not the filters show it. */
export const positionsOf = (model: Model): ReadonlyArray<RadarPosition> =>
  Match.value(model.data).pipe(
    Match.tag('Ready', ({ dataset }) => layoutEntries(dataset.entries)),
    Match.orElse(() => []),
  );

/** The entries the filters show. */
export const visibleOf = (model: Model): ReadonlyArray<RadarPosition> =>
  filterPositions(positionsOf(model), filtersOf(model));

export const isVisible = (model: Model, id: string): boolean =>
  visibleOf(model).some(({ entry }) => entry.id === id);

export const positionOf = (model: Model, id: string): Option.Option<RadarPosition> =>
  Option.fromNullishOr(positionsOf(model).find(({ entry }) => entry.id === id));

/** A blip's scene key: entry ids are unique, so its keys are. */
export const blipKey = (id: string): string => `blip:${id}`;

/** Reads an entry id back from a blip's scene key. */
export const idOfBlip = (key: string): Option.Option<string> =>
  Option.fromNullishOr(/^blip:(.+)$/.exec(key)?.[1]);
