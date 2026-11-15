import { Effect } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type {
  ApplicationConfig,
  ApplicationConfigWithFlags,
  RenderedApplication,
} from 'foldkit/experimental/server';

import type { AppConfigContract, PageConfigContract } from './types';

type ServerConfig<Flags extends object> = Pick<
  PageConfigContract<Flags>,
  'Flags' | 'init' | 'view'
>;

export async function renderFoldkitServerApplication<Flags extends object>(
  config: ServerConfig<Flags>,
  flags: Flags,
  buildId?: string,
): Promise<RenderedApplication> {
  return await Effect.runPromise(
    renderToString(
      // SAFETY: The surrounding package boundary establishes this value before the assertion.
      {
        Flags: config.Flags,
        init: config.init,
        view: config.view,
      } as ApplicationConfigWithFlags<unknown, never, Flags>,
      { flags, buildId },
    ),
  );
}

type IslandConfig<Props extends object> = Pick<AppConfigContract<Props>, 'init' | 'view'>;

/**
 * Renders an island's first paint as static markup.
 *
 * The island declares no Flags, and needs none: `renderToString` accepts a
 * config whose `init` takes no argument, so the props Astro already serialises
 * for the client are closed over here. `isHydratable: false` is what keeps
 * this safe beside other islands — the render carries no root stamp, so it
 * cannot collide with another island's, and `Runtime.hydrate`'s one-root rule
 * never applies because nothing hydrates this markup. The client's existing
 * `embed` replaces it on boot.
 */
export async function renderFoldkitIslandMarkup<Props extends object>(
  config: IslandConfig<Props>,
  props: Props,
): Promise<RenderedApplication> {
  return await Effect.runPromise(
    renderToString(
      // SAFETY: The surrounding package boundary establishes this value before the assertion.
      {
        init: () => config.init(props),
        view: config.view,
      } as ApplicationConfig<unknown, never>,
      { isHydratable: false },
    ),
  );
}
