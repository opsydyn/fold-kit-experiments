import * as Cloudflare from '@alchemy.run/cloudflare';

export const AuthDb = Cloudflare.D1.Database('ZlozTeamAuth', {
  // Both Teams Alchemy launchers run from apps/zloz-team.
  migrations: '../zloz-server/migrations',
});
