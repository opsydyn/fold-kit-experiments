import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudflare from '@astrojs/cloudflare';
import effectUi from '@opsydyn/astro-effect-ui';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'astro/config';
import { Schema } from 'effect';

import manifest from '../../package.json';

const root = dirname(fileURLToPath(new URL('../../package.json', import.meta.url)));
const workspacePaths = globSync(
  manifest.workspaces.packages.map((pattern) => pattern + '/package.json'),
  { cwd: root },
);
const readManifest = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Struct({ name: Schema.String })),
);
const inventory = workspacePaths.sort().map((file) => ({
  path: file.slice(0, -'/package.json'.length),
  name: readManifest(readFileSync(join(root, file), 'utf8')).name,
}));

const isDevCommand = process.argv.includes('dev');

export default defineConfig({
  output: 'server',
  devToolbar: { enabled: false },
  integrations: [effectUi({ interaction: false })],

  vite: {
    define: { __FIELD_GUIDE_WORKSPACES__: JSON.stringify(inventory) },
    plugins: [vanillaExtractPlugin()],
    // Prebundle the analysis and graph clients so discovery cannot reload the page during input.
    optimizeDeps: {
      include: [
        '@ag-ui/client',
        '@ag-ui/core',
        '@ag-ui/core/schemas',
        '@effect/ui',
        '@effect/ui/html',
        '@opsydyn/astro-effect-ui/component',
        '@opsydyn/foldkit-zloz',
        '@opsydyn/foldkit-zloz/effect-ui',
        '@opsydyn/foldkit-zloz-elk',
        '@opsydyn/foldkit-zloz-elk > elkjs/lib/elk.bundled.js',
        'effect',
        'fast-json-patch',
      ],
      // Load Viz's published ESM subpaths directly to avoid re-optimizing on route changes.
      exclude: ['@opsydyn/foldkit-viz'],
    },
  },

  adapter: isDevCommand ? undefined : cloudflare(),
});
