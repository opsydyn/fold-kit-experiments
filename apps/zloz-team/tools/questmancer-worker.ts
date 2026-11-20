import { fileURLToPath } from 'node:url';

import * as Cloudflare from '@alchemy.run/cloudflare';
import { Config, Effect } from 'effect';

import type { QuestRoom } from '../src/questmancer/worker';

export const questmancerWorker = Effect.gen(function* () {
  const sprites = yield* Cloudflare.R2.Bucket('QuestmancerArtwork');
  return yield* Cloudflare.Worker('QuestmancerPrivateWorker', {
    main: fileURLToPath(new URL('../src/questmancer/worker.ts', import.meta.url)),
    workersDev: { enabled: false, previewsEnabled: false },
    dev: {
      port: Config.Number('ZLOZ_QUESTMANCER_PORT').pipe(Config.withDefault(4333)),
      strictPort: true,
    },
    compatibility: { date: '2026-11-11', flags: ['nodejs_compat'] },
    assets: {
      directory: fileURLToPath(new URL('../src/questmancer/fixtures', import.meta.url)),
      runWorkerFirst: true,
    },
    env: {
      ROOM: Cloudflare.DurableObject<QuestRoom>('QuestRoom', { storage: 'sqlite' }),
      SPRITES: sprites,
      GENERATE: Cloudflare.Workflow<{ teamId: string; id: string }>('QuestmancerSampleArt', {
        className: 'SpriteWorkflow',
      }),
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: false },
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  });
});
