import { fileURLToPath } from 'node:url';

import * as Cloudflare from '@alchemy.run/cloudflare';

export const AuthDb = Cloudflare.D1.Database('ZlozTeamAuth', {
  migrations: fileURLToPath(new URL('../migrations', import.meta.url)),
});
