/**
 * Deep links: the address bar describes the view, so a copied URL opens the radar exactly
 * there. A link names a pinned entry, an edition (by date, so links outlive new editions),
 * a view, the filters, whether edges show and a picked theme. Never the raw camera: a drag
 * is not a place worth linking, and its noise would churn the URL. Pure; the shell reads
 * and writes the URL.
 */
import type { Vec3 } from '@opsydyn/effect-three';
import { Match, Option, Schema } from 'effect';

import { Category, Ring, ringIds } from './data';
import { clusterCamera, editionsOf, flightTo, type Model, positionOf } from './model';
import { isBirdsEye } from './space';
import { Theme } from './themes';

/** Where a link stands: above the map, at a category's cluster, or at its pinned entry. */
export type Standpoint =
  | Readonly<{ _tag: 'Universe' }>
  | Readonly<{ _tag: 'Cluster'; category: Category }>
  | Readonly<{ _tag: 'Entry' }>;

/** A link, decoded: each part is there or not. */
export type DeepLink = Readonly<{
  entry: Option.Option<string>;
  edition: Option.Option<string>;
  standpoint: Option.Option<Standpoint>;
  query: Option.Option<string>;
  category: Option.Option<Category>;
  rings: Option.Option<ReadonlyArray<Ring>>;
  edges: Option.Option<'off'>;
  theme: Option.Option<Theme>;
  /** `compare=<date>`: an earlier edition to compare the linked one with. */
  compare: Option.Option<string>;
  /** `tour=edition`: play the linked edition's own tour on arrival. */
  tour: Option.Option<'edition'>;
}>;

/** A link's query parameters, as the page hands them over. */
export type LinkParams = Readonly<Record<string, string>>;

const entryId = /^[a-z0-9][a-z0-9-]{0,79}$/;
const calendarDate = /^\d{4}-\d{2}-\d{2}$/;
const longestQuery = 100;

const param = (params: LinkParams, name: string): Option.Option<string> =>
  Option.fromNullishOr(params[name]);

const matching = (params: LinkParams, name: string, pattern: RegExp): Option.Option<string> =>
  Option.filter(param(params, name), (value) => pattern.test(value));

/** A `cluster:<category>` view. */
const clusterFrom = (value: string): Option.Option<Standpoint> =>
  Option.map(
    Option.flatMap(
      Option.fromNullishOr(/^cluster:(.+)$/.exec(value)?.[1]),
      Schema.decodeUnknownOption(Category),
    ),
    (category): Standpoint => ({ _tag: 'Cluster', category }),
  );

/** A `view` parameter as a standpoint: `universe`, `entry` or `cluster:<category>`. */
const standpointFrom = (value: string): Option.Option<Standpoint> =>
  Match.value(value).pipe(
    Match.when('universe', (): Option.Option<Standpoint> => Option.some({ _tag: 'Universe' })),
    Match.when('entry', (): Option.Option<Standpoint> => Option.some({ _tag: 'Entry' })),
    Match.orElse(clusterFrom),
  );

/** A `rings` parameter: a comma list of rings, each known, at least one. */
const ringsFrom = (value: string): Option.Option<ReadonlyArray<Ring>> => {
  const named = new Set(value.split(','));
  const rings = ringIds.filter((ring) => named.has(ring));
  return Option.liftPredicate(rings, (known) => known.length > 0 && known.length === named.size);
};

/** Reads a link from query parameters, dropping any part that is unknown or malformed. */
export const decodeLink = (params: LinkParams): DeepLink => ({
  entry: matching(params, 'entry', entryId),
  edition: matching(params, 'edition', calendarDate),
  standpoint: Option.flatMap(param(params, 'view'), standpointFrom),
  query: Option.filter(
    Option.map(param(params, 'q'), (query) => query.trim()),
    (query) => query.length > 0 && query.length <= longestQuery,
  ),
  category: Option.flatMap(param(params, 'category'), Schema.decodeUnknownOption(Category)),
  rings: Option.flatMap(param(params, 'rings'), ringsFrom),
  edges: Option.flatMap(param(params, 'edges'), Schema.decodeUnknownOption(Schema.Literal('off'))),
  theme: Option.flatMap(param(params, 'theme'), Schema.decodeUnknownOption(Theme)),
  compare: matching(params, 'compare', calendarDate),
  tour: Option.flatMap(
    param(params, 'tour'),
    Schema.decodeUnknownOption(Schema.Literal('edition')),
  ),
});

/** Whether the camera is aimed exactly where `camera` would put it. */
const aimedAt = (model: Model, camera: Readonly<{ position: Vec3 }>): boolean =>
  model.camera.position.every(
    (value, axis) => Math.abs(value - (camera.position[axis] ?? 0)) < 1e-9,
  );

/**
 * Where the camera stands, as a link names it: at its pinned entry or a cluster when it is
 * aimed exactly there, above the map from any bearing. At home, or after a drag, nowhere
 * a link needs to name.
 */
export const standpointOf = (model: Model): Option.Option<Standpoint> => {
  const atEntry = Option.exists(
    Option.flatMap(model.selected, (id) => positionOf(model, id)),
    (position) => aimedAt(model, flightTo(position)),
  );
  const atCluster = Option.filter(model.cluster, (category) =>
    aimedAt(model, clusterCamera(category)),
  );
  return Match.value({ atEntry, above: isBirdsEye(model.camera.position) }).pipe(
    Match.when({ atEntry: true }, (): Option.Option<Standpoint> => Option.some({ _tag: 'Entry' })),
    Match.when({ above: true }, (): Option.Option<Standpoint> => Option.some({ _tag: 'Universe' })),
    Match.orElse(() =>
      Option.map(atCluster, (category): Standpoint => ({ _tag: 'Cluster', category })),
    ),
  );
};

const standpointParam = (standpoint: Standpoint): string =>
  Match.value(standpoint).pipe(
    Match.tag('Universe', () => 'universe'),
    Match.tag('Entry', () => 'entry'),
    Match.tag('Cluster', ({ category }) => `cluster:${category}`),
    Match.exhaustive,
  );

/** The shown edition's date, unless it is the current one, which a link leaves out. */
const editionParam = (model: Model): Option.Option<string> => {
  const editions = editionsOf(model);
  return Option.map(
    Option.filter(
      Option.fromNullishOr(editions[model.edition]),
      () => model.edition < editions.length - 1,
    ),
    ({ authoredOn }) => authoredOn,
  );
};

/** The earlier edition being compared with, by its date. */
const compareParam = (model: Model): Option.Option<string> =>
  Option.flatMap(
    Option.filter(model.comparing, (from) => from < model.edition),
    (from) =>
      Option.map(Option.fromNullishOr(editionsOf(model)[from]), ({ authoredOn }) => authoredOn),
  );

/** The filters a link carries: only those that differ from the radar as it opens. */
const ringsParam = (model: Model): Option.Option<string> =>
  Option.map(
    Option.liftPredicate(model.enabledRings, (rings) => rings.length < ringIds.length),
    (rings) => rings.join(','),
  );

/** The link for the view as it stands, as a query string without its `?`. */
export const linkOf = (model: Model): string => {
  const parts: ReadonlyArray<readonly [string, Option.Option<string>]> = [
    ['entry', model.selected],
    ['edition', editionParam(model)],
    ['compare', compareParam(model)],
    ['view', Option.map(standpointOf(model), standpointParam)],
    ['q', Option.liftPredicate(model.query.trim(), (query) => query.length > 0)],
    // "all" is no category, so it decodes to nothing and stays out of the link.
    ['category', Schema.decodeUnknownOption(Category)(model.category)],
    ['rings', ringsParam(model)],
    ['edges', Option.liftPredicate('off', () => !model.showRelationships)],
    ['theme', Schema.decodeUnknownOption(Theme)(model.themeChoice)],
  ];
  return new URLSearchParams(
    parts.flatMap(([name, value]) =>
      Option.match(value, { onNone: () => [], onSome: (shown) => [[name, shown]] }),
    ),
  ).toString();
};
