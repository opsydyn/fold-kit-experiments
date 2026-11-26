import effectUi from '@opsydyn/astro-effect-ui';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [effectUi()],
});
