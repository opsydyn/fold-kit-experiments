import effectUi from '@opsydyn/astro-effect-ui';
import type { AstroUserConfig } from 'astro';
import { defineConfig } from 'astro/config';

const config: AstroUserConfig = {
  output: 'static',
  integrations: [effectUi()],
  base: process.env.ZLOZ_PROMO_BASE_PATH ?? '/',
  trailingSlash: 'always',
  server: { port: 4329 },
  devToolbar: { enabled: false },
};
const site = process.env.ZLOZ_PROMO_SITE_URL;
if (site !== undefined) config.site = site;
export default defineConfig(config);
