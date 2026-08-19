import { Effect } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { ApplicationConfigWithFlags, RenderedApplication } from 'foldkit/experimental/server';

import type { PageConfigShape } from './types';

type ServerConfig<Flags extends Record<string, unknown>> = Pick<
  PageConfigShape<Flags>,
  'Flags' | 'init' | 'view'
>;

export async function renderFoldkitServerApplication<Flags extends Record<string, unknown>>(
  config: ServerConfig<Flags>,
  flags: Flags,
  buildId: string,
): Promise<RenderedApplication> {
  return await Effect.runPromise(
    renderToString(
      {
        Flags: config.Flags,
        init: config.init,
        view: config.view,
      } as ApplicationConfigWithFlags<unknown, never, Flags>,
      { flags, buildId },
    ),
  );
}
