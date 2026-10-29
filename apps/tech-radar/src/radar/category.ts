/**
 * What a category's page shows at an edition: its entries a ring at a time, each with how
 * it got there and its trail across the editions; what changed in the category; and how
 * many entries it held in each ring in every edition. Pure, so the page is a thin template.
 *
 * @module
 */
import { Match, Option } from 'effect';

import {
  type EditionInfo,
  entriesAt,
  entryHref,
  historyOf,
  radarHref,
  type Standing,
  type Status,
  statusAt,
  statusGlyph,
  statusText,
} from './pages';
import {
  type Category,
  type RadarDataset,
  type RadarEntry,
  type Ring,
  ringIds,
  ringLabels,
} from './three/data';

export type CategoryCard = Readonly<{
  entry: RadarEntry;
  /** Its key on the category's map, counting from 1 in ring order. */
  number: number;
  ring: Ring;
  href: string;
  radarHref: string;
  status: Status;
  /** Whether it is new, back or moved in this edition: never in the first. */
  changed: boolean;
  glyph: string;
  statusLine: string;
  history: ReadonlyArray<Standing>;
}>;

/** Something that happened to an entry in the category in the edition shown. */
export type CategoryChange = Readonly<{
  name: string;
  href: string;
  glyph: string;
  text: string;
}>;

export type RingCount = Readonly<{ ring: Ring; count: number }>;

export type CategoryPage = Readonly<{
  category: Category;
  edition: EditionInfo;
  count: number;
  rings: ReadonlyArray<Readonly<{ ring: Ring; cards: ReadonlyArray<CategoryCard> }>>;
  changes: ReadonlyArray<CategoryChange>;
  /** How many of its entries stood in each ring, in every edition, oldest first. */
  composition: ReadonlyArray<
    Readonly<{ edition: EditionInfo; total: number; rings: ReadonlyArray<RingCount> }>
  >;
}>;

const inCategory = (dataset: RadarDataset, index: number, category: Category) =>
  entriesAt(dataset, index).filter((placed) => placed.entry.category === category);

/** A status worth calling out: anything but holding its ring. */
const isChange = (status: Status): boolean => status._tag !== 'Steady';

/** What happened to an entry in the edition, in words: "Moved in from Assess to Trial". */
const changeText = (status: Status, ring: Ring): string =>
  Match.value(status).pipe(
    Match.tag('New', () => `New in ${ringLabels[ring]}`),
    Match.tag('Returned', () => `Back on the radar in ${ringLabels[ring]}`),
    Match.tag(
      'Moved',
      ({ from, direction }) => `Moved ${direction} from ${ringLabels[from]} to ${ringLabels[ring]}`,
    ),
    Match.tag('Steady', () => `Still in ${ringLabels[ring]}`),
    Match.exhaustive,
  );

/** A category's page at the edition `index`, or none if there's no such edition. */
export const categoryPage = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  category: Category,
  index: number,
): Option.Option<CategoryPage> =>
  Option.map(Option.fromNullishOr(editions[index]), (edition) => {
    const placed = ringIds.flatMap((ring) =>
      inCategory(dataset, index, category).filter((candidate) => candidate.ring === ring),
    );
    const cards = placed.map(({ entry, ring }, at): CategoryCard => {
      const history = historyOf(dataset, editions, entry);
      const status = Option.getOrElse(
        statusAt(history, index),
        (): Status => ({ _tag: 'Steady', since: edition }),
      );
      return {
        entry,
        number: at + 1,
        ring,
        href: entryHref(dataset, entry.id, index),
        radarHref: radarHref(dataset, entry.id, index),
        status,
        changed: index > 0 && isChange(status),
        glyph: statusGlyph(status),
        statusLine: statusText(status, ring, edition),
        history,
      };
    });
    const onNow = new Set(placed.map(({ entry }) => entry.id));
    const left = (index > 0 ? inCategory(dataset, index - 1, category) : [])
      .filter(({ entry }) => !onNow.has(entry.id))
      .map(
        ({ entry, ring }): CategoryChange => ({
          name: entry.name,
          href: entryHref(dataset, entry.id, index - 1),
          glyph: '✕',
          text: `Left the radar from ${ringLabels[ring]}`,
        }),
      );
    const changes = [
      ...cards
        .filter(({ changed }) => changed)
        .map(
          (card): CategoryChange => ({
            name: card.entry.name,
            href: card.href,
            glyph: card.glyph,
            text: changeText(card.status, card.ring),
          }),
        ),
      ...left,
    ];
    const composition = editions.map((shown) => {
      const there = inCategory(dataset, shown.index, category);
      return {
        edition: shown,
        total: there.length,
        rings: ringIds.map((ring) => ({
          ring,
          count: there.filter((candidate) => candidate.ring === ring).length,
        })),
      };
    });
    return {
      category,
      edition,
      count: cards.length,
      rings: ringIds.map((ring) => ({ ring, cards: cards.filter((card) => card.ring === ring) })),
      changes,
      composition,
    };
  });

export const trailSize = { width: 72, height: 26 } as const;

export type Trail = Readonly<{
  /** The line between editions it stood in, broken where it was off the radar. */
  path: string;
  marks: ReadonlyArray<Readonly<{ x: number; y: number; current: boolean }>>;
}>;

/**
 * An entry's ring across the editions, small enough for a card: one column per edition,
 * Adopt at the top, and the edition `shown` marked.
 */
export const trailOf = (history: ReadonlyArray<Standing>, shown: number): Trail => {
  const pad = 4;
  const step = history.length > 1 ? (trailSize.width - 2 * pad) / (history.length - 1) : 0;
  const rowOf = (ring: Ring) =>
    pad + (ringIds.indexOf(ring) / (ringIds.length - 1)) * (trailSize.height - 2 * pad);
  const points = history.map(({ ring }, at) =>
    Option.map(ring, (placed) => ({ x: pad + at * step, y: rowOf(placed), current: at === shown })),
  );
  const path = points
    .map((point, at) =>
      Option.match(point, {
        onNone: () => '',
        onSome: ({ x, y }) =>
          `${Option.isSome(points[at - 1] ?? Option.none()) ? 'L' : 'M'}${x} ${y}`,
      }),
    )
    .join('');
  return { path, marks: points.flatMap(Option.toArray) };
};
