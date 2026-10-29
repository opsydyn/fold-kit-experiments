/**
 * What the site's pages show, worked out from the radar's dataset. Pure, so the pages are
 * thin templates and these are tested without Astro.
 *
 * Editions are numbered oldest first, as the radar numbers them: the last is the current
 * one. An entry's page at an earlier edition shows it as it stood then.
 *
 * @module
 */
import { Match, Option } from 'effect';

import {
  type Category,
  categoryIds,
  type RadarDataset,
  type RadarEntry,
  type Ring,
  ringIds,
  ringLabels,
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

/**
 * How an entry came to stand where it does in an edition: new to the radar, back after an
 * absence, moved in (towards Adopt) or out from another ring, or unchanged since an
 * edition.
 */
export type Status =
  | Readonly<{ _tag: 'New' }>
  | Readonly<{ _tag: 'Returned' }>
  | Readonly<{ _tag: 'Moved'; from: Ring; direction: 'in' | 'out' }>
  | Readonly<{ _tag: 'Steady'; since: EditionInfo }>;

/** The entry's status at the edition `index` of its history; none if it was absent then. */
export const statusAt = (history: ReadonlyArray<Standing>, index: number): Option.Option<Status> =>
  Option.flatMap(Option.fromNullishOr(history[index]), (shown) =>
    Option.map(shown.ring, (ring): Status => {
      const before = history.slice(0, index);
      const holds = (standing: Standing) => Option.contains(standing.ring, ring);
      // The edition after the last one where it stood anywhere else, or nowhere.
      const since = history[before.findLastIndex((standing) => !holds(standing)) + 1]?.edition;
      const steady: Status = { _tag: 'Steady', since: since ?? shown.edition };
      const fromAbsence = (): Status =>
        Match.value({
          first: index === 0,
          seen: before.some((standing) => Option.isSome(standing.ring)),
        }).pipe(
          Match.when({ first: true }, () => steady),
          Match.when({ seen: true }, (): Status => ({ _tag: 'Returned' })),
          Match.orElse((): Status => ({ _tag: 'New' })),
        );
      const fromRing = (held: Ring): Status =>
        Match.value(held === ring).pipe(
          Match.when(true, () => steady),
          Match.orElse(
            (): Status => ({
              _tag: 'Moved',
              from: held,
              direction: ringIds.indexOf(ring) < ringIds.indexOf(held) ? 'in' : 'out',
            }),
          ),
        );
      const previous = Option.flatMap(Option.fromNullishOr(before.at(-1)), ({ ring }) => ring);
      return Option.match(previous, { onNone: fromAbsence, onSome: fromRing });
    }),
  );

/** Where an entry stood in every edition, oldest first: its ring, or none when absent. */
export const historyOf = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  entry: RadarEntry,
): ReadonlyArray<Standing> =>
  editions.map((edition) => ({ edition, ring: ringAt(dataset, entry, edition.index) }));

/** A mark for a status, shown beside its words: never the only way to read it. */
export const statusGlyph = (status: Status): string =>
  Match.value(status).pipe(
    Match.tag('New', () => '✦'),
    Match.tag('Returned', () => '↺'),
    Match.tag('Moved', ({ direction }) => (direction === 'in' ? '▲' : '▼')),
    Match.tag('Steady', () => '●'),
    Match.exhaustive,
  );

/** A status in words, as of the edition shown: "Moved in from Trial in the fourth edition". */
export const statusText = (status: Status, ring: Ring, edition: EditionInfo): string => {
  const at = `in the ${edition.label.toLowerCase()}`;
  return Match.value(status).pipe(
    Match.tag('New', () => `New ${at}`),
    Match.tag('Returned', () => `Back on the radar ${at}`),
    Match.tag(
      'Moved',
      ({ from, direction }) => `Moved ${direction} from ${ringLabels[from]} ${at}`,
    ),
    Match.tag(
      'Steady',
      ({ since }) => `${ringLabels[ring]} since the ${since.label.toLowerCase()}`,
    ),
    Match.exhaustive,
  );
};

export type EntryPage = Readonly<{
  entry: RadarEntry;
  edition: EditionInfo;
  ring: Ring;
  /** Where it stood in every edition, oldest first: its ring, or none when absent. */
  history: ReadonlyArray<Standing>;
  status: Status;
  relations: ReadonlyArray<
    Relation &
      Readonly<{
        name: string;
        href: string;
        category: Option.Option<Category>;
        /** The other entry's ring in the edition, or none if it was not on the radar then. */
        ring: Option.Option<Ring>;
      }>
  >;
  /** The other entries in its category and ring at this edition, in the radar's order. */
  peers: ReadonlyArray<Readonly<{ id: string; name: string; href: string }>>;
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
    const find = (other: string) =>
      Option.fromNullishOr(dataset.entries.find((candidate) => candidate.id === other));
    const history = historyOf(dataset, editions, entry);
    const status = Option.getOrElse(
      statusAt(history, index),
      (): Status => ({ _tag: 'Steady', since: edition }),
    );
    const relations = relationsOf(dataset.relationships ?? [], id).map((relation) => {
      const other = find(relation.other);
      const name = Option.match(other, {
        onNone: () => relation.other,
        onSome: (found) => found.name,
      });
      const category = Option.map(other, (found) => found.category);
      const otherRing = Option.flatMap(other, (found) => ringAt(dataset, found, index));
      const href = entryHref(dataset, relation.other, index);
      return { ...relation, name, href, category, ring: otherRing };
    });
    const peers = entriesAt(dataset, index)
      .filter(
        (placed) =>
          placed.entry.category === entry.category &&
          placed.ring === ring &&
          placed.entry.id !== id,
      )
      .map(({ entry: peer }) => ({
        id: peer.id,
        name: peer.name,
        href: entryHref(dataset, peer.id, index),
      }));
    return {
      entry,
      edition,
      ring,
      history,
      status,
      relations,
      peers,
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
