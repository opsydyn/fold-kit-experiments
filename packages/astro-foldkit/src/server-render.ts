import { Effect } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { ApplicationConfigWithFlags, RenderedApplication } from 'foldkit/experimental/server';

import type { PageConfigContract } from './types';

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
