import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [foldkit()],
  server: { port: 4327 },
  devToolbar: { enabled: false },
});
