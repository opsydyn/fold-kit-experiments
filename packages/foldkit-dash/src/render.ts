/**
 * Building interactive pages (ADR 0110): the page script, bundled once per build from
 * `client.ts` and named by its content hash, and each app page rendered to HTML by
 * the Effect UI server renderer with that hash as its build id.
 * @module Render
 */
import { join } from 'node:path';

import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';

import { Dash, type Flags } from './app';

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

/** Escape JSON for a script data block, including authored closing-tag text. */
const inlineJson = (value: Flags) => JSON.stringify(value).replaceAll('<', '\\u003c');

export const renderApp = (flags: Flags, buildId: string) =>
  HtmlServer.renderToHtml(Dash, flags).pipe(
    Effect.map(
      ({ html, state }) =>
        `<div data-dash-root data-dash-build="${buildId}">${html}</div>` +
        `<script type="application/json" data-dash-state>${HtmlServer.serializeState(state)}</script>` +
        `<script type="application/json" data-dash-props>${inlineJson(flags)}</script>`,
    ),
  );
