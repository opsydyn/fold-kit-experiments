import type { AstroUserConfig } from 'astro';
import { defineConfig } from 'astro/config';

const config: AstroUserConfig = {
  output: 'static',
  base: process.env.ZLOZ_PROMO_BASE_PATH ?? '/',
  trailingSlash: 'always',
  server: { port: 4329 },
  devToolbar: { enabled: false },
};
const site = process.env.ZLOZ_PROMO_SITE_URL;
if (site !== undefined) config.site = site;
export default defineConfig(config);
