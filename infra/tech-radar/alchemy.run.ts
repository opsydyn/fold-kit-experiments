/*
 * The tech radar on Cloudflare: one Worker that renders the 3D radar per request, with the
 * prerendered pages and client assets served beside it.
 *
 * This workspace has its own Effect (the `infra` catalog). Alchemy needs a newer one than
 * FoldKit's exact pin, and the CLI is a separate program from the site it builds, so the
 * two never share a copy. The site itself builds with apps/tech-radar's dependencies.
 *
 *   bun run plan     # what a deploy would change, for your dev_$USER stage
 *   bun run deploy   # build apps/tech-radar and deploy it
 *   bun run destroy  # remove the stage
 */
import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Alchemy from 'alchemy';
import { Effect } from 'effect';

export default Alchemy.Stack(
  'tech-radar',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.Astro('TechRadar', {
      rootDir: '../../apps/tech-radar',
      // The site has no sessions, so no KV namespace for them.
      sessionKVBindingName: false,
      // No `assets.notFoundHandling`: with it, Cloudflare answers a browser navigation that
      // matches no file with the 404 page and never runs the Worker, so `/` (rendered per
      // request) would 404. Astro serves its own 404 page for unknown addresses instead.
    });
    return { url: site.url };
  }),
);
