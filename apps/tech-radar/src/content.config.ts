import { glob } from 'astro/loaders';
/*
 * The radar's markdown. The collections declare no schema: `src/radar/content.ts` decodes
 * the frontmatter with Effect Schema when it assembles the radar, so the build and the
 * tests check it the same way.
 */
import { defineCollection } from 'astro:content';

export const collections = {
  radar: defineCollection({ loader: glob({ pattern: 'radar.md', base: './src/content' }) }),
  editions: defineCollection({ loader: glob({ pattern: '*.md', base: './src/content/editions' }) }),
  entries: defineCollection({ loader: glob({ pattern: '*.md', base: './src/content/entries' }) }),
};
