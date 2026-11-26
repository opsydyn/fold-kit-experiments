import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudflare from '@astrojs/cloudflare';
import foldkit from '@opsydyn/astro-foldkit';
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
  integrations: [foldkit()],

  vite: {
    define: { __FIELD_GUIDE_WORKSPACES__: JSON.stringify(inventory) },
    plugins: [vanillaExtractPlugin()],
  },

  adapter: isDevCommand ? undefined : cloudflare(),
});
