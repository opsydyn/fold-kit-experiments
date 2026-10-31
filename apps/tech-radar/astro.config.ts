import foldkit from '@opsydyn/astro-foldkit';
import { defineConfig, fontProviders } from 'astro/config';

const fontsource = fontProviders.fontsource();

// No adapter: Alchemy supplies Cloudflare's when it builds the site (see the plan,
// docs/superpowers/plans/2026-10-28-tech-radar-app.md).
export default defineConfig({
  // Where the radar is published: link previews, the feed and the sitemap give full
  // addresses on it. Preview stages link back to production, which is what a share wants.
  site: 'https://techradar.opsydyn.xyz',
  integrations: [foldkit()],
  // Fetch a page when a link to it is hovered or focused, so moving between pages is quick.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  trailingSlash: 'always',
  // The typefaces' families (see src/radar/three/typefaces.ts), served from the site with
  // metric-matched fallbacks. The display faces also come as .woff: the 3D radar's labels
  // are drawn by troika, which reads .woff but not .woff2.
  fonts: [
    {
      provider: fontsource,
      name: 'B612',
      cssVariable: '--font-b612',
      weights: [400, 700],
      subsets: ['latin'],
      formats: ['woff2', 'woff'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'B612 Mono',
      cssVariable: '--font-b612-mono',
      weights: [400, 700],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
    {
      provider: fontsource,
      name: 'Jost',
      cssVariable: '--font-jost',
      weights: [500, 600],
      subsets: ['latin'],
      formats: ['woff2', 'woff'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: [400, 600],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 500],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
    {
      provider: fontsource,
      name: 'Michroma',
      cssVariable: '--font-michroma',
      weights: [400],
      subsets: ['latin'],
      formats: ['woff2', 'woff'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'Exo 2',
      cssVariable: '--font-exo',
      weights: [400, 600],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'Share Tech Mono',
      cssVariable: '--font-share-tech-mono',
      weights: [400],
      subsets: ['latin'],
      fallbacks: ['monospace'],
    },
  ],
  server: { port: 4326 },
  devToolbar: { enabled: false },
});
