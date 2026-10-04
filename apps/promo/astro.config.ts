import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [foldkit()],
  // Astro 7 creates a separate prerender environment; keep FoldKit bundled there too.
  vite: {
    plugins: [
      {
        name: 'promo:foldkit-environment',
        configEnvironment: () => ({
          resolve: { noExternal: ['foldkit', '@foldkit/ui', '@foldkit/devtools'] },
        }),
      },
    ],
  },
  trailingSlash: 'always',
  server: { port: 4322 },
  devToolbar: { enabled: false },
});
