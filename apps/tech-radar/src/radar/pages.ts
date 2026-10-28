/**
 * What the site's pages show, worked out from the radar's dataset. Pure, so the pages are
 * thin templates and these are tested without Astro.
 *
 * Editions are numbered oldest first, as the radar numbers them: the last is the current
 * one. An entry's page at an earlier edition shows it as it stood then.
 *
 * @module
 */
import { Option } from 'effect';

import {
  type Category,
  categoryIds,
  type RadarDataset,
  type RadarEntry,
  type Ring,
  ringIds,
} from './three/data';
import { type Edition, editionsOf, initialModel, type Model } from './three/model';
import { type Relation, relationsOf } from './three/relations';
import { changesIn } from './three/timeline';

/** The radar's model holding just the dataset: the copied radar's helpers read it. */
const modelOf = (dataset: RadarDataset): Model =>
  initialModel(
    { assetBase: '', title: '', links: [], pages: Option.none() },
    { _tag: 'Ready', dataset },
  );

export type EditionInfo = Readonly<{
  index: number;
  date: string;
  label: string;
  isCurrent: boolean;
}>;

/** Every edition, oldest first; the current one takes its label from its markdown. */
export const editionsIn = (
  dataset: RadarDataset,
  currentLabel: string,
): ReadonlyArray<EditionInfo> => {
  const editions = editionsOf(modelOf(dataset));
  return editions.map((edition, index) => ({
    index,
    date: edition.authoredOn,
    label: index === editions.length - 1 ? currentLabel : edition.label,
    isCurrent: index === editions.length - 1,
  }));
};

const editionAt = (dataset: RadarDataset, index: number): Option.Option<Edition> =>
  Option.fromNullishOr(editionsOf(modelOf(dataset))[index]);

/** The entry's ring in an edition, or none if it wasn't on the radar then. */
export const ringAt = (
  dataset: RadarDataset,
  entry: RadarEntry,
  index: number,
): Option.Option<Ring> =>
  Option.flatMap(editionAt(dataset, index), (edition) =>
    edition.absent.includes(entry.id)
      ? Option.none()
      : Option.some(edition.rings[entry.id] ?? entry.ring),
  );

const currentIndex = (dataset: RadarDataset): number => (dataset.editions ?? []).length;

/** An earlier edition's date, or none for the current edition (or one out of range). */
const earlierDate = (dataset: RadarDataset, index: number): Option.Option<string> =>
  index < currentIndex(dataset)
    ? Option.map(editionAt(dataset, index), ({ authoredOn }) => authoredOn)
    : Option.none();

const isOn = (dataset: RadarDataset, id: string, index: number): boolean => {
  const entry = dataset.entries.find((candidate) => candidate.id === id);
  return entry !== undefined && Option.isSome(ringAt(dataset, entry, index));
};

/**
 * The address of an entry's page at an edition: that edition's page while it was on an
 * earlier edition, its current page otherwise.
 */
export const entryHref = (dataset: RadarDataset, id: string, index: number): string =>
  Option.match(
    Option.filter(earlierDate(dataset, index), () => isOn(dataset, id, index)),
    {
      onNone: () => `/blip/${id}/`,
      onSome: (date) => `/edition/${date}/blip/${id}/`,
    },
  );

/** The 3D radar opened on the entry, in the edition the page shows. */
export const radarHref = (dataset: RadarDataset, id: string, index: number): string =>
  Option.match(earlierDate(dataset, index), {
    onNone: () => `/?entry=${id}`,
    onSome: (date) => `/?entry=${id}&edition=${date}`,
  });

/** The entries on the radar at an edition, with their rings then, in the radar's order. */
export const entriesAt = (
  dataset: RadarDataset,
  index: number,
): ReadonlyArray<Readonly<{ entry: RadarEntry; ring: Ring }>> =>
  dataset.entries.flatMap((entry) =>
    Option.match(ringAt(dataset, entry, index), {
      onNone: () => [],
      onSome: (ring) => [{ entry, ring }],
    }),
  );

/** Entries at an edition grouped by category, then by ring, every group in the radar's order. */
export const byCategoryAndRing = (
  dataset: RadarDataset,
  index: number,
): ReadonlyArray<
  Readonly<{
    category: Category;
    rings: ReadonlyArray<Readonly<{ ring: Ring; entries: ReadonlyArray<RadarEntry> }>>;
  }>
> => {
  const present = entriesAt(dataset, index);
  return categoryIds.map((category) => ({
    category,
    rings: ringIds.map((ring) => ({
      ring,
      entries: present
        .filter((placed) => placed.entry.category === category && placed.ring === ring)
        .map(({ entry }) => entry),
    })),
  }));
};

export type Standing = Readonly<{ edition: EditionInfo; ring: Option.Option<Ring> }>;

export type EntryPage = Readonly<{
  entry: RadarEntry;
  edition: EditionInfo;
  ring: Ring;
  /** Where it stood in every edition, oldest first: its ring, or none when absent. */
  history: ReadonlyArray<Standing>;
  relations: ReadonlyArray<Relation & { readonly name: string; readonly href: string }>;
  /** Its neighbours in its category at this edition, in the radar's order. */
  previous: Option.Option<RadarEntry>;
  next: Option.Option<RadarEntry>;
}>;

/** An entry's page at an edition, or none if it wasn't on the radar then. */
export const entryPage = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  id: string,
  index: number,
): Option.Option<EntryPage> => {
  const entry = dataset.entries.find((candidate) => candidate.id === id);
  const edition = editions[index];
  if (entry === undefined || edition === undefined) return Option.none();
  return Option.map(ringAt(dataset, entry, index), (ring) => {
    const neighbours = entriesAt(dataset, index)
      .map((placed) => placed.entry)
      .filter((candidate) => candidate.category === entry.category);
    const at = neighbours.findIndex((candidate) => candidate.id === id);
    const nameOf = (other: string) =>
      dataset.entries.find((candidate) => candidate.id === other)?.name ?? other;
    return {
      entry,
      edition,
      ring,
      history: editions.map((standing) => ({
        edition: standing,
        ring: ringAt(dataset, entry, standing.index),
      })),
      relations: relationsOf(dataset.relationships ?? [], id).map((relation) => ({
        ...relation,
        name: nameOf(relation.other),
        href: entryHref(dataset, relation.other, index),
      })),
      previous: Option.fromNullishOr(neighbours[at - 1]),
      next: Option.fromNullishOr(neighbours[at + 1]),
    };
  });
};

/** What changed in an edition since the one before, in words; nothing for the first. */
export const changesAt = (dataset: RadarDataset, index: number): ReadonlyArray<string> =>
  changesIn(modelOf(dataset), index);

/** Every earlier edition's entry pages to prerender: each entry on each earlier edition. */
export const editionEntryPaths = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
): ReadonlyArray<Readonly<{ date: string; id: string; index: number }>> =>
  editions
    .filter((edition) => !edition.isCurrent)
    .flatMap((edition) =>
      entriesAt(dataset, edition.index).map(({ entry }) => ({
        date: edition.date,
        id: entry.id,
        index: edition.index,
      })),
    );
