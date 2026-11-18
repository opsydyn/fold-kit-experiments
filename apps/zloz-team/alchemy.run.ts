import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Alchemy from 'alchemy';

import { localApp } from './tools/local-app';
import { requireLocalDevelopment } from './tools/local-only';

// Qualification is local only. Production has its own explicit activation gate.
requireLocalDevelopment();

export default Alchemy.Stack(
  'zloz-team-qualification',
  {
    providers: Cloudflare.providers(),
    state: Alchemy.localState(),
  },
  localApp,
);
