import { fileURLToPath } from 'node:url';

import { make } from '@alchemy.run/frontend-frameworks/astro';
import { target } from '@alchemy.run/frontend-frameworks/astro/cloudflare';
import { BunRuntime, BunServices } from '@effect/platform-bun';
import { Effect } from 'effect';

process.env.ALCHEMY_WORKERD_PATH = fileURLToPath(import.meta.resolve('workerd/bin/workerd'));

make({
  root: fileURLToPath(new URL('..', import.meta.url)),
  target: target({
    sessions: false,
    sessionDevKV: false,
    worker: { compatibilityDate: '2026-11-11', worker: { name: 'zloz-team-build', bindings: [] } },
  }),
}).pipe(
  Effect.flatMap((framework) => framework.build()),
  Effect.scoped,
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
