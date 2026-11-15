import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

// A minimal site for checking astro-foldkit against each supported Astro major.
export default defineConfig({
  integrations: [foldkit()],
});
