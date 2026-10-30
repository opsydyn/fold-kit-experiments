/**
 * Link previews: the card a chat app or social site shows when a page is shared. Each page
 * has one, drawn from the radar's data at build time: what the page is, a line about it,
 * and a small radar with the entries it is about lit up. Pure: `src/pages/preview/`
 * renders these to PNG.
 *
 * @module
 */
import { Option } from 'effect';

import { changesAt, entriesAt, type EditionInfo, ringAt } from './pages';
import {
  type Category,
  categoryIds,
  categoryLabels,
  type RadarDataset,
  type Ring,
  ringIds,
  ringLabels,
} from './three/data';
import { css, themes } from './three/themes';

/** One page's card. */
export type Preview = Readonly<{
  /** Where the card is served, under `/preview/`, without `.png`. */
  path: string;
  eyebrow: string;
  title: string;
  badge: Option.Option<string>;
  body: string;
  footer: string;
  /** The category whose colour the card wears, or none for the radar's accent. */
  category: Option.Option<Category>;
  /** The edition the small radar shows. */
  edition: number;
  /** The entries lit on the small radar; the others are dimmed. */
  lit: ReadonlyArray<string>;
  /** The entry ringed on the small radar, on an entry's card. */
  focus: Option.Option<string>;
}>;

/** The card's colours: the radar's Night theme, as the pages use by default. */
export const previewColours = {
  page: css(themes.night.page),
  panel: css(themes.night.panel),
  border: css(themes.night.border),
  ink: css(themes.night.ink),
  muted: css(themes.night.muted),
  accent: css(themes.night.accent),
  category: (category: Category): string => css(themes.night.categories[category]),
} as const;

/** The card for the page at `pathname`: `/blip/effect/` has `blip/effect`, `/` has `radar`. */
export const previewPath = (pathname: string): string =>
  pathname.replace(/^\/+|\/+$/g, '') || 'radar';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const entryCards = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  title: string,
): ReadonlyArray<Preview> =>
  editions.flatMap((edition) =>
    dataset.entries.flatMap((entry) =>
      Option.match(ringAt(dataset, entry, edition.index), {
        onNone: () => [],
        onSome: (ring): ReadonlyArray<Preview> => [
          {
            path: edition.isCurrent
              ? `blip/${entry.id}`
              : `edition/${edition.date}/blip/${entry.id}`,
            eyebrow: categoryLabels[entry.category],
            title: entry.name,
            badge: Option.some(ringLabels[ring]),
            body: entry.description,
            footer: `${title} · ${edition.label} · ${edition.date}`,
            category: Option.some(entry.category),
            edition: edition.index,
            lit: [entry.id],
            focus: Option.some(entry.id),
          },
        ],
      }),
    ),
  );

/** Every page's card: the radar, its categories, tags, editions and entry pages. */
export const previewsOf = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  tags: ReadonlyArray<{ readonly tag: string; readonly ids: ReadonlyArray<string> }>,
  about: { readonly title: string; readonly intro: string },
): ReadonlyArray<Preview> => {
  const current = editions.at(-1);
  const index = current?.index ?? 0;
  const footer = `${about.title} · ${current?.label ?? ''} · ${current?.date ?? ''}`;
  const onNow = entriesAt(dataset, index);
  const none = Option.none<string>();
  const radar: Preview = {
    path: 'radar',
    eyebrow: plural(onNow.length, 'entry', 'entries'),
    title: about.title,
    badge: Option.none(),
    body: about.intro,
    footer,
    category: Option.none(),
    edition: index,
    lit: onNow.map(({ entry }) => entry.id),
    focus: none,
  };
  const categories = categoryIds.map((category): Preview => {
    const inCategory = onNow.filter(({ entry }) => entry.category === category);
    return {
      path: `category/${category}`,
      eyebrow: plural(inCategory.length, 'entry', 'entries'),
      title: categoryLabels[category],
      badge: Option.none(),
      body: ringIds
        .map((ring) => ({ ring, count: inCategory.filter((held) => held.ring === ring).length }))
        .filter(({ count }) => count > 0)
        .map(({ ring, count }) => `${count} in ${ringLabels[ring]}`)
        .join(' · '),
      footer,
      category: Option.some(category),
      edition: index,
      lit: inCategory.map(({ entry }) => entry.id),
      focus: none,
    };
  });
  const tagCards = tags.map(
    ({ tag, ids }): Preview => ({
      path: `tag/${tag}`,
      eyebrow: plural(ids.length, 'entry', 'entries'),
      title: `#${tag}`,
      badge: Option.none(),
      body: dataset.entries
        .filter(({ id }) => ids.includes(id))
        .map(({ name }) => name)
        .join(' · '),
      footer,
      category: Option.none(),
      edition: index,
      lit: ids,
      focus: none,
    }),
  );
  const editionCards = editions.map((edition): Preview => {
    const changes = changesAt(dataset, edition.index);
    return {
      path: `edition/${edition.date}`,
      eyebrow: edition.date,
      title: edition.label,
      badge: Option.none(),
      body: changes.length === 0 ? 'The radar as it began.' : changes.slice(0, 3).join(' · '),
      footer: `${about.title} · ${plural(changes.length, 'change', 'changes')}`,
      category: Option.none(),
      edition: edition.index,
      lit: entriesAt(dataset, edition.index).map(({ entry }) => entry.id),
      focus: none,
    };
  });
  return [
    radar,
    ...categories,
    ...tagCards,
    ...editionCards,
    ...entryCards(dataset, editions, about.title),
  ];
};

/** A number in [0, 1) from a string, the same on every build. */
const unit = (text: string, salt: number): number => {
  const hash = [...text].reduce(
    (sum, character) => Math.imul(sum ^ character.charCodeAt(0), 0x01000193) >>> 0,
    0x811c9dc5 ^ salt,
  );
  return (hash % 10_000) / 10_000;
};

/** Each ring's band, as fractions of the radius, Adopt innermost. */
const bands = {
  adopt: [0.08, 0.38],
  trial: [0.4, 0.6],
  assess: [0.62, 0.8],
  caution: [0.82, 0.97],
} as const satisfies Record<Ring, readonly [number, number]>;

/** Each category's quarter, as the start of its angle in degrees (clockwise from east). */
const quarters = {
  techniques: 180,
  'languages-frameworks': 270,
  platforms: 0,
  tools: 90,
} as const satisfies Record<Category, number>;

/** A blip's place: its category's quarter and its ring's band, scattered by its id. */
export const blipAt = (id: string, category: Category, ring: Ring, radius: number) => {
  const [inner, outer] = bands[ring];
  const angle = ((quarters[category] + 8 + unit(id, 1) * 74) * Math.PI) / 180;
  const distance = radius * (inner + unit(id, 2) * (outer - inner));
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
};

/** The small radar as an SVG document, `size` pixels square. */
export const radarSvg = (dataset: RadarDataset, preview: Preview, size: number): string => {
  const radius = size / 2 - 4;
  const centre = size / 2;
  const lit = new Set(preview.lit);
  const rings = ringIds
    .map(
      (ring) =>
        `<circle cx="${centre}" cy="${centre}" r="${(bands[ring][1] + 0.01) * radius}" fill="none" stroke="${previewColours.muted}" stroke-opacity="0.45" stroke-width="2"/>`,
    )
    .join('');
  const axes = `<path d="M${centre} 4V${size - 4}M4 ${centre}H${size - 4}" stroke="${previewColours.muted}" stroke-opacity="0.3" stroke-width="2"/>`;
  const blips = entriesAt(dataset, preview.edition)
    .map(({ entry, ring }) => {
      const { x, y } = blipAt(entry.id, entry.category, ring, radius);
      const on = lit.has(entry.id);
      const fill = previewColours.category(entry.category);
      return `<circle cx="${(centre + x).toFixed(1)}" cy="${(centre + y).toFixed(1)}" r="${on ? 9 : 6}" fill="${fill}" fill-opacity="${on ? 1 : 0.25}"/>`;
    })
    .join('');
  const focused = Option.flatMap(preview.focus, (id) =>
    Option.fromNullishOr(dataset.entries.find((entry) => entry.id === id)),
  );
  const focusAt = Option.flatMap(focused, (entry) =>
    Option.map(ringAt(dataset, entry, preview.edition), (ring) =>
      blipAt(entry.id, entry.category, ring, radius),
    ),
  );
  const focus = Option.match(focusAt, {
    onNone: () => '',
    onSome: ({ x, y }) =>
      `<circle cx="${(centre + x).toFixed(1)}" cy="${(centre + y).toFixed(1)}" r="20" fill="none" stroke="${previewColours.ink}" stroke-width="3"/>`,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${axes}${blips}${focus}</svg>`;
};
