import { fileURLToPath } from 'node:url';

import * as Cloudflare from '@alchemy.run/cloudflare';
import ZlozServer from '@opsydyn/zloz-server/src/worker';
import * as Alchemy from 'alchemy';
import { Config, Effect, Redacted, Schema } from 'effect';

import { questmancerWorker } from './tools/questmancer-worker';
import { STAGING_HOST, STAGING_STACK, validateStagingConfiguration } from './tools/staging-config';

const configuredTeamId = (key: string) =>
  Config.schema(Schema.String.check(Schema.isPattern(/^(?:[A-Za-z0-9_-]{1,128})?$/)), key).pipe(
    Config.withDefault(''),
  );

export default Alchemy.Stack(
  STAGING_STACK,
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const origin = yield* Config.String('ZLOZ_ORIGIN');
    const qualificationProbe = yield* Config.Boolean('ZLOZ_QUALIFICATION_PROBE').pipe(
      Config.withDefault(false),
    );
    const clientId = yield* Config.String('GOOGLE_CLIENT_ID');
    const clientSecret = yield* Config.Redacted('GOOGLE_CLIENT_SECRET');
    validateStagingConfiguration({
      stage,
      origin,
      clientId,
      clientSecret: Redacted.value(clientSecret),
      qualificationProbe,
    });
    const backend = yield* ZlozServer;
    const questmancer = yield* questmancerWorker;
    const pilotTeam = yield* configuredTeamId('ZLOZ_QUESTMANCER_TEAM');
    const previewTeam = yield* configuredTeamId('ZLOZ_QUESTMANCER_PREVIEW_TEAM');
    const app = yield* Cloudflare.Website.Astro('ZlozTeamStagingApp', {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      domain: STAGING_HOST,
      workersDev: false,
      sessionKVBindingName: false,
      compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
      env: {
        ZLOZ_BACKEND: backend,
        QUESTMANCER: questmancer,
        QUESTMANCER_TEAM: pilotTeam,
        QUESTMANCER_PREVIEW_TEAM: previewTeam,
      },
      observability: {
        enabled: true,
        logs: { enabled: true, invocationLogs: true },
        traces: { enabled: true, headSamplingRate: 0.1 },
      },
    });
    return { url: app.url, origin, callback: `${origin}/api/auth/callback/google` };
  }),
);
