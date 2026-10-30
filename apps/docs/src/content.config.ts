/*
 * Starlight's docs collection is the repository's docs/ folder, read in place
 * (see repoDocs.ts).
 */
import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';

import { repoDocs } from './repoDocs';

export const collections = {
  docs: defineCollection({ loader: repoDocs(), schema: docsSchema() }),
};
