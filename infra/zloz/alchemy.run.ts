import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Alchemy from 'alchemy';
import { Effect } from 'effect';

/** Separate stack/state from Tech Radar; only production owns the public hostname. */
export default Alchemy.Stack(
  'zloz',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const site = yield* Cloudflare.Website.StaticSite('ZlozWorkbench', {
      cwd: '../../apps/zloz-demo',
      command: 'bun run build',
      outdir: 'dist',
      domain: stage === 'prod' ? 'zloz.opsydyn.xyz' : null,
      compatibility: { date: '2026-11-08' },
      assets: { htmlHandling: 'auto-trailing-slash', notFoundHandling: '404-page' },
      observability: {
        enabled: true,
        logs: { enabled: true, invocationLogs: true },
        traces: { enabled: true, headSamplingRate: 0.1 },
      },
      memo: {
        include: [
          'src/**',
          'public/**',
          'astro.config.ts',
          'package.json',
          'tsconfig.json',
          '../../packages/foldkit-zloz*/**',
          '../../packages/astro-foldkit/**',
          '../../packages/foldkit-viz/**',
          '../../docs/assets/zloz/final/*.svg',
          '../../package.json',
        ],
        lockfile: true,
      },
    });
    return { url: site.url };
  }),
);
