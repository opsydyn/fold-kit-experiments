import { fileURLToPath } from 'node:url';

import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

import { rehypeRepoLinks } from './src/repoLinks';

// Served at the root locally and under /fold-kit-experiments/docs/ on GitHub Pages.
const base = process.env.DOCS_BASE_PATH ?? '/';
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/** A sidebar group of every page in a docs/ folder. */
const folder = (label: string, directory: string, collapsed = false) => ({
  label,
  collapsed,
  items: [{ autogenerate: { directory } }],
});

export default defineConfig({
  site: process.env.DOCS_SITE_URL ?? 'https://opsydyn.github.io',
  base,
  trailingSlash: 'always',
  server: { port: 4327 },
  markdown: {
    rehypePlugins: [
      rehypeRepoLinks({
        repoRoot,
        docsRoot: `${repoRoot}docs/`,
        base: base.endsWith('/') ? base : `${base}/`,
        repo: 'opsydyn/fold-kit-experiments',
        branch: 'main',
      }),
    ],
  },
  integrations: [
    starlight({
      title: 'fold-kit-experiments',
      description:
        'Decisions, spikes, releases and working notes for the fold-kit-experiments monorepo.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/opsydyn/fold-kit-experiments',
        },
      ],
      sidebar: [
        { label: 'Start here', items: ['index', 'roadmap'] },
        folder('Decisions', 'adr'),
        folder('effect-three decisions', 'effect-three/adr', true),
        {
          label: 'Spikes',
          items: ['spikes/radar-proposals', 'effect-three/spike-results', 'examples/ag-ui-spike'],
        },
        folder('Releases', 'releases'),
        folder('Assessments', 'assessments'),
        folder('Postmortems', 'postmortems'),
        folder('Migrations', 'migrations'),
        {
          label: 'effect-three',
          collapsed: true,
          items: [
            'effect-three/brief',
            'effect-three/plan',
            'effect-three/roadmap',
            'effect-three/references',
            'effect-three/drei-audit',
            'effect-three/devtools-mcp-notes',
          ],
        },
        folder('Examples', 'examples', true),
        folder('Working notes: plans', 'superpowers/plans', true),
        folder('Working notes: specs', 'superpowers/specs', true),
      ],
    }),
  ],
});
