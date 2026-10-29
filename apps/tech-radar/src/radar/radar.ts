/*
 * The radar the site shows, assembled from the content collections at build time. A
 * page that imports it never reads markdown on a request. A bad edit throws here, which
 * stops the build with the file that caused it.
 */
import { getCollection, getEntry } from 'astro:content';
import { Result, Schema } from 'effect';

import { assembleRadar, EditionFile, RadarFile } from './content';
import { editionsIn } from './pages';
import type { Category } from './three/data';
import type { Pages } from './three/model';

const editionFiles = await getCollection('editions');

export const radar = Result.getOrThrowWith(
  assembleRadar({ editions: editionFiles, entries: await getCollection('entries') }),
  (reason) => new Error(`The radar's markdown: ${reason}`),
);

const radarFile = await getEntry('radar', 'radar');
const about = Schema.decodeUnknownSync(RadarFile)(radarFile?.data);

/** The radar's name, from `radar.md`. */
export const radarTitle = about.title;

/** The radar's introduction, the body of `radar.md`, as plain text for link previews. */
export const radarIntro = (radarFile?.body ?? '').trim();

/** What each ring means, from `radar.md`. */
export const ringMeanings = about.rings;

/** What each category holds, from `radar.md`, where it says. */
export const categoryIntros: Partial<Record<Category, string>> = about.categories ?? {};

const currentLabel =
  editionFiles
    .map(({ data }) => Schema.decodeUnknownSync(EditionFile)(data))
    .find(({ date }) => date === radar.authoredOn)?.label ?? 'Current edition';

/** Every edition, oldest first, the current one last. */
export const editions = editionsIn(radar, currentLabel);

/** The current edition's index. */
export const current = editions.length - 1;

/** Where each entry's full page is, for the radars' "Open full page" links. */
export const pages: Pages = {
  entry: '/blip/{id}/',
  editionEntry: '/edition/{edition}/blip/{id}/',
};
