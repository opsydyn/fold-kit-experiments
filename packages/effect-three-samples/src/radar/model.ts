import { perspectiveCamera, SceneSchema, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option, Schema } from 'effect';

import {
  categoryIds,
  loadDemoRadar,
  type RadarData,
  type RadarRelationship,
  Ring,
  ringIds,
} from './data';
import { filterPositions, layoutEntries, type RadarFilters, type RadarPosition } from './layout';
import { bearingOf, onSphere, shellRadius, zoomLimits } from './space';

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
  /** Whether the relationship edges are drawn. */
  showRelationships: Schema.Boolean,
  /** The stage's width over its height, from the last gesture; square until then. */
  stageAspect: Schema.Number,
  camera: SceneSchema.Camera,
});
export type Model = Omit<typeof Model.Type, 'data'> & Readonly<{ data: RadarData }>;

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

export const initialModel = (assetBase: string, data: RadarData = loadDemoRadar()): Model => ({
  assetBase,
  data,
  query: '',
  category: 'all',
  enabledRings: ringIds,
  hovered: Option.none(),
  selected: Option.none(),
  showRelationships: true,
  stageAspect: 1,
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
