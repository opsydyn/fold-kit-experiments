/*
 * The radar the site shows, assembled from the content collections at build time. A
 * page that imports it never reads markdown on a request. A bad edit throws here, which
 * stops the build with the file that caused it.
 */
import { getCollection } from 'astro:content';
import { Result } from 'effect';

import { assembleRadar } from './content';

export const radar = Result.getOrThrowWith(
  assembleRadar({
    editions: await getCollection('editions'),
    entries: await getCollection('entries'),
  }),
  (reason) => new Error(`The radar's markdown: ${reason}`),
);
