import { fileURLToPath } from 'node:url';

import * as Cloudflare from '@alchemy.run/cloudflare';
import ZlozServer from '@opsydyn/zloz-server/src/worker';
import { Config, Effect } from 'effect';

import { questmancerWorker } from './questmancer-worker';

const localPort = Config.Number('ZLOZ_PORT').pipe(Config.withDefault(4331));
const localQuestmancer = Config.Boolean('ZLOZ_QUESTMANCER').pipe(Config.withDefault(false));
const localPreview = Config.Boolean('ZLOZ_QUESTMANCER_PREVIEW').pipe(Config.withDefault(false));

export const localApp = Effect.gen(function* () {
  const backend = yield* ZlozServer;
  const port = yield* localPort;
  const questmancerEnabled = yield* localQuestmancer;
  const previewEnabled = yield* localPreview;
  const previewTeam = previewEnabled ? '*' : '';
  const questmancer = questmancerEnabled ? yield* questmancerWorker : undefined;
  const app = yield* Cloudflare.Website.Astro('ZlozTeamApp', {
    rootDir: fileURLToPath(new URL('..', import.meta.url)),
    sessionKVBindingName: false,
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    env: questmancer
      ? {
          ZLOZ_BACKEND: backend,
          QUESTMANCER: questmancer,
          QUESTMANCER_TEAM: '*',
          QUESTMANCER_PREVIEW_TEAM: previewTeam,
        }
      : { ZLOZ_BACKEND: backend, QUESTMANCER_PREVIEW_TEAM: previewTeam },
    dev: { port, strictPort: true },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true },
    },
  });
  return { url: app.url };
});
