/**
 * Building interactive pages (ADR 0110): the page script, bundled once per build from
 * `client.ts` and named by its content hash, and each app page rendered to HTML by
 * Foldkit's server renderer with that hash as its build id.
 * @module Render
 */
import { join } from 'node:path';

import { Effect } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { type Flags, Flags as FlagsSchema, init, view } from './app';

/** The page script: its file name, its build id and its text. */
export type ClientScript = {
  readonly file: string;
  readonly buildId: string;
  readonly text: string;
};

/** Where the build puts the page script, under the output folder. */
export const scriptFolder = '_dash';

/**
 * Bundles the page script: minified, as a classic script (one that also runs from
 * `file://`), named by the first twelve hex digits of its SHA-256.
 */
export const bundleClient = Effect.tryPromise({
  try: async (): Promise<ClientScript> => {
    const built = await Bun.build({
      entrypoints: [join(import.meta.dir, 'client.ts')],
      target: 'browser',
      format: 'iife',
      minify: true,
    });
    const [output] = built.outputs;
    if (!built.success || output === undefined) {
      throw new Error(built.logs.map((log) => String(log)).join('\n'));
    }
    const text = await output.text();
    const buildId = new Bun.CryptoHasher('sha256').update(text).digest('hex').slice(0, 12);
    return { file: `${scriptFolder}/client-${buildId}.js`, buildId, text };
  },
  catch: (error) => new Error(`could not bundle the page script: ${String(error)}`),
});

/** An interactive page's app, rendered: its root element and its Flags. */
export const renderApp = (flags: Flags, buildId: string) =>
  renderToString({ Flags: FlagsSchema, init, view }, { flags, buildId }).pipe(
    Effect.map((rendered) => rendered.html),
  );
