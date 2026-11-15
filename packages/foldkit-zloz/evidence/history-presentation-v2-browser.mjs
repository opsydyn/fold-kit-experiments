import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import {
  zlozView,
  zlozHistoryComparisonPresentationV2,
  zlozHistoryGhostsV2,
  zlozLightTheme,
  zlozDarkTheme,
} from '../src/foldkit.ts';
import {
  parseModelDocumentV2,
  createEditorFromConnectionDocument,
  resolveHistoryComparisonPresentationV2,
} from '../src/index.ts';
import wire from '../test/fixtures/model-v2-modes.json' with { type: 'json' };

const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const baseline = parseModelDocumentV2(JSON.stringify(wire)).editions[0];
const modeOnly = {
  ...baseline,
  name: 'Strict edition',
  snapshot: { ...baseline.snapshot, connectionMode: 'strict' },
};
const selected = {
  ...modeOnly,
  name: 'Revised layout',
  snapshot: {
    ...modeOnly.snapshot,
    graph: {
      ...modeOnly.snapshot.graph,
      nodes: modeOnly.snapshot.graph.nodes.map((node) =>
        node.id === 'a' ? { ...node, position: { x: 60, y: 160 } } : node,
      ),
    },
    viewport: { x: 20, y: 50, zoom: 0.9 },
  },
};
const output = await Effect.runPromise(
  renderToString(
    {
      Flags: Schema.Struct({}),
      init: () => ({ model: {} }),
      view: (_model, h) => ({
        title: 'V2 comparison presentation — package fixture',
        body: h.main(
          [],
          [
            h.h1([], ['Checkpoint meaning, visible at a glance']),
            h.p(
              [],
              [
                'Static package-rendered fixture · mode-only comparison and retained ghost preferences',
              ],
            ),
            h.section(
              [],
              [
                zlozHistoryComparisonPresentationV2(
                  h,
                  resolveHistoryComparisonPresentationV2(baseline, modeOnly),
                ),
              ],
            ),
            h.div(
              [h.Class('panels')],
              ['light', 'dark'].map((scheme) => {
                const minimalMode = scheme === 'dark';
                const context = resolveHistoryComparisonPresentationV2(baseline, selected, {
                  minimalMode,
                });
                // oxlint-disable-next-line linteffect/no-resource-without-acquire-release -- Pure editor initialization returns immutable data, not a browser resource.
                const editor = createEditorFromConnectionDocument(selected.snapshot, {
                  readOnly: true,
                });
                return h.section(
                  [h.Class(scheme)],
                  [
                    h.h2([], [minimalMode ? 'Dark · minimal mode' : 'Light · comparison ghosts']),
                    zlozHistoryComparisonPresentationV2(h, context),
                    h.p(
                      [],
                      [
                        minimalMode
                          ? 'Ghosts hidden; layer preferences retained.'
                          : 'Dashed outlines show previous geometry. Connectors show movement.',
                      ],
                    ),
                    zlozView(h, editor, {
                      id: `comparison-${scheme}`,
                      label: `${scheme} comparison preview`,
                      onEvent: (event) => event,
                      height: 330,
                      minimalMode: true,
                      theme: scheme === 'dark' ? zlozDarkTheme : zlozLightTheme,
                      renderWorldOverlay: (_overlay, builder) =>
                        zlozHistoryGhostsV2(builder, context),
                    }),
                  ],
                );
              }),
            ),
          ],
        ),
      }),
    },
    { flags: {}, isHydratable: false },
  ),
);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>V2 comparison package fixture</title><style>
body{margin:0;background:#f6f5f2;color:#172126;font:15px/1.5 system-ui}main{max-width:1160px;margin:28px auto}h1{font-size:26px;margin:0}h2{font-size:19px;margin:0 0 12px}p{margin:8px 0 14px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}section{padding:20px;border:1px solid #cbd0d4;border-radius:12px;background:white}[role=status]{display:grid;gap:4px}[data-zloz-history-mode]{font-weight:650}.dark{background:#192126;color:#e7edf2;border-color:#39434c}.dark p{color:#b8c5cc}
</style>${output.html}</html>`;
await writeFile(new URL('history-presentation-v2.html', import.meta.url), html);
const browser = await chromium.launch();
async function capture() {
  const page = await browser.newPage({
    viewport: { width: 1220, height: 710 },
    reducedMotion: 'reduce',
  });
  await page.setContent(html);
  await expect(page.locator('[role=status][aria-label="History comparison"]')).toHaveCount(3);
  await expect(page.locator('.light [data-zloz-history-node]')).toHaveCount(1);
  await expect(page.locator('.light [data-zloz-history-movement]')).toHaveCount(1);
  await expect(page.locator('.dark [data-zloz-history-ghosts]')).toHaveCount(0);
  await expect(page.locator('[data-zloz-history-mode]')).toHaveText(
    Array(3).fill('Connection mode changed from loose to strict.'),
  );
  await page.screenshot({
    path: fileURLToPath(new URL('history-presentation-v2.png', import.meta.url)),
    fullPage: true,
  });
}
await capture().finally(() => browser.close());
