import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import {
  graphSurface,
  historyComparisonV2,
  historyGhostsV2,
  zlozLightTheme,
  zlozDarkTheme,
} from '../src/effect-ui.ts';
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
const Fixture = Html.component({
  name: 'HistoryComparisonFixture',
  model: Schema.Null,
  message: Schema.String,
}).make({
  init: () => null,
  update: () => null,
  view: (h) =>
    h.main.children(
      h.h1.children('Checkpoint meaning, visible at a glance'),
      h.p.children(
        'Static package-rendered fixture · mode-only comparison and retained ghost preferences',
      ),
      h.section.children(
        historyComparisonV2(h, resolveHistoryComparisonPresentationV2(baseline, modeOnly)),
      ),
      h.div.class('panels').children(
        ...['light', 'dark'].map((scheme) => {
          const minimalMode = scheme === 'dark';
          const context = resolveHistoryComparisonPresentationV2(baseline, selected, {
            minimalMode,
          });
          // oxlint-disable-next-line linteffect/no-resource-without-acquire-release -- Build immutable editor state without acquiring a resource.
          const editor = createEditorFromConnectionDocument(selected.snapshot, { readOnly: true });
          return h.section.class(scheme).children(
            h.h2.children(minimalMode ? 'Dark · minimal mode' : 'Light · comparison ghosts'),
            historyComparisonV2(h, context),
            h.p.children(
              minimalMode
                ? 'Ghosts hidden; layer preferences retained.'
                : 'Dashed outlines show previous geometry. Connectors show movement.',
            ),
            h.div.style({ height: '330px' }).children(
              graphSurface(h, editor, {
                id: `comparison-${scheme}`,
                label: `${scheme} comparison preview`,
                onInput: ({ type }) => type,
                theme: minimalMode ? zlozDarkTheme : zlozLightTheme,
                worldOverlay: historyGhostsV2(context),
              }),
            ),
          );
        }),
      ),
    ),
});
const output = await Effect.runPromise(HtmlServer.renderToHtml(Fixture, {}, { static: true }));
const capturePath = (file) =>
  process.env.ZLOZ_CAPTURE_DIR
    ? resolve(process.env.ZLOZ_CAPTURE_DIR, file)
    : fileURLToPath(new URL(file, import.meta.url));
const canvasCss = await readFile(new URL('../src/effect-ui.css', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>V2 comparison package fixture</title><style>
body{margin:0;background:#f6f5f2;color:#172126;font:15px/1.5 system-ui}main{max-width:1160px;margin:28px auto}h1{font-size:26px;margin:0}h2{font-size:19px;margin:0 0 12px}p{margin:8px 0 14px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}section{padding:20px;border:1px solid #cbd0d4;border-radius:12px;background:white}[role=status]{display:grid;gap:4px}[data-zloz-history-mode]{font-weight:650}.dark{background:#192126;color:#e7edf2;border-color:#39434c}.dark p{color:#b8c5cc}
${canvasCss}</style>${output.html}</html>`;
await writeFile(capturePath('history-presentation-v2.html'), html);
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
    path: capturePath('history-presentation-v2.png'),
    fullPage: true,
  });
}
await capture().finally(() => browser.close());
