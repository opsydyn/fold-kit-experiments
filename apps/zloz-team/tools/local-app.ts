import { fileURLToPath } from 'node:url';

import * as Cloudflare from '@alchemy.run/cloudflare';
import ZlozServer from '@opsydyn/zloz-server/src/worker';
import { Config, Effect } from 'effect';

const localPort = Config.Number('ZLOZ_PORT').pipe(Config.withDefault(4331));

export const localApp = Effect.gen(function* () {
  const backend = yield* ZlozServer;
  const port = yield* localPort;
  const app = yield* Cloudflare.Website.Astro('ZlozTeamApp', {
    rootDir: fileURLToPath(new URL('..', import.meta.url)),
    sessionKVBindingName: false,
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    env: { ZLOZ_BACKEND: backend },
    dev: { port, strictPort: true },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true },
    },
  });
  return { url: app.url };
});
