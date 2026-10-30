/**
 * What the site tells other software about itself: each page's link preview, the 3D
 * radar's preview for a deep link, the Atom feed of editions and the sitemap. Pure, so the
 * pages and endpoints stay thin and these are tested without Astro.
 *
 * @module
 */
import { Option } from 'effect';

import { type EditionInfo, editionEntryPaths, entriesAt, ringAt } from './pages';
import { categoryIds, categoryLabels, type RadarDataset, ringLabels } from './three/data';
import { decodeLink, type LinkParams } from './three/link';
import { initialModel } from './three/model';
import { changesIn } from './three/timeline';

/** A page's title and summary, as a link preview shows them. */
export type Preview = Readonly<{ title: string; description: string }>;

/** The radar's name and introduction, from `radar.md`. */
export type About = Readonly<{ title: string; intro: string }>;

const modelOf = (dataset: RadarDataset) =>
  initialModel(
    { assetBase: '', title: '', links: [], pages: Option.none() },
    { _tag: 'Ready', dataset },
  );

/**
 * The 3D radar's preview for a deep link: the entry it pins, the category it stands at or
 * the edition it shows, so a shared link says where it goes. Anything a link can't name
 * falls back to the radar's own preview.
 */
export const linkPreview = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  about: About,
  params: LinkParams,
): Preview => {
  const link = decodeLink(params);
  const latest = editions.at(-1);
  const edition = Option.getOrElse(
    Option.flatMap(link.edition, (date) =>
      Option.fromNullishOr(editions.find((candidate) => candidate.date === date)),
    ),
    () => latest,
  );
  const shown = edition ?? latest;
  const named = (label: string) => `${label} · ${about.title}`;
  const radar: Preview = {
    title: shown === undefined || shown.isCurrent ? about.title : named(shown.label),
    description: about.intro,
  };
  const entry = Option.flatMap(link.entry, (id) =>
    Option.fromNullishOr(dataset.entries.find((candidate) => candidate.id === id)),
  );
  const cluster = Option.flatMap(link.standpoint, (standpoint) =>
    standpoint._tag === 'Cluster' ? Option.some(standpoint.category) : Option.none(),
  );
  const ofEntry = Option.map(entry, (found): Preview => {
    const ring = ringAt(dataset, found, shown?.index ?? 0);
    const label = Option.match(ring, {
      onNone: () => found.name,
      onSome: (held) => `${found.name} · ${ringLabels[held]}`,
    });
    return { title: named(label), description: found.description };
  });
  const ofCluster = Option.map(
    cluster,
    (category): Preview => ({
      title: named(categoryLabels[category]),
      description: `${categoryLabels[category]} on the radar, ${(shown?.label ?? '').toLowerCase()}.`,
    }),
  );
  return Option.getOrElse(
    Option.orElse(ofEntry, () => ofCluster),
    () => radar,
  );
};

const escape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const at = (site: URL, path: string): string => new URL(path, site).href;

const dayOf = (date: string): string => `${date}T00:00:00Z`;

/** An edition's feed entry as HTML: how many entries it holds and what changed. */
const editionHtml = (dataset: RadarDataset, edition: EditionInfo): string => {
  const changes = changesIn(modelOf(dataset), edition.index);
  const count = `<p>${entriesAt(dataset, edition.index).length} entries on the radar.</p>`;
  const list =
    changes.length === 0
      ? ''
      : `<ul>${changes.map((change) => `<li>${escape(change)}</li>`).join('')}</ul>`;
  return count + list;
};

/** The Atom feed: one entry per edition, newest first, each with what changed in it. */
export const feedXml = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  about: About,
  site: URL,
): string => {
  const newestFirst = [...editions].reverse();
  const updated = dayOf(newestFirst[0]?.date ?? '1970-01-01');
  const entries = newestFirst.map((edition) => {
    const href = at(site, `/edition/${edition.date}/`);
    return [
      '  <entry>',
      `    <title>${escape(`${edition.label} · ${edition.date}`)}</title>`,
      `    <link href="${href}"/>`,
      `    <id>${href}</id>`,
      `    <updated>${dayOf(edition.date)}</updated>`,
      `    <content type="html">${escape(editionHtml(dataset, edition))}</content>`,
      '  </entry>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escape(about.title)}</title>`,
    `  <subtitle>${escape(about.intro)}</subtitle>`,
    `  <link href="${at(site, '/feed.xml')}" rel="self"/>`,
    `  <link href="${at(site, '/')}"/>`,
    `  <id>${at(site, '/')}</id>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>${escape(about.title)}</name></author>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n');
};

/** Every page's address: the radar, its categories, editions and entries in each edition. */
export const sitePaths = (
  dataset: RadarDataset,
  editions: ReadonlyArray<EditionInfo>,
  tagNames: ReadonlyArray<string> = [],
): ReadonlyArray<string> => [
  '/',
  ...categoryIds.map((id) => `/category/${id}/`),
  ...tagNames.map((tag) => `/tag/${tag}/`),
  ...editions.map(({ date }) => `/edition/${date}/`),
  ...dataset.entries.map(({ id }) => `/blip/${id}/`),
  ...editionEntryPaths(dataset, editions).map(({ date, id }) => `/edition/${date}/blip/${id}/`),
];

/** The sitemap of every page. */
export const sitemapXml = (paths: ReadonlyArray<string>, site: URL): string =>
  [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${escape(at(site, path))}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
