import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';

import { historyChangeNavigatorV2, historyComparisonV2 } from '../src/effect-ui.ts';
import {
  compareEditionsV2,
  parseModelDocumentV2,
  resolveHistoryChangeNavigatorV2,
  resolveHistoryChangeFocusV2,
  resolveHistoryComparisonPresentationV2,
} from '../src/index.ts';
import wire from '../test/fixtures/model-v2-modes.json' with { type: 'json' };

const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const baseline = parseModelDocumentV2(JSON.stringify(wire)).editions[0];
const selected = {
  ...baseline,
  id: 'next',
  name: 'Revised edition',
  snapshot: {
    ...baseline.snapshot,
    connectionMode: 'strict',
    graph: {
      nodes: [
        { ...baseline.snapshot.graph.nodes[0], label: 'Revised A', position: { x: 500, y: 60 } },
      ],
      edges: [],
    },
  },
};
const comparison = compareEditionsV2(baseline, selected);
const presentation = resolveHistoryComparisonPresentationV2(baseline, selected);
const Fixture = Html.component({
  name: 'HistoryNavigationFixture',
  model: Schema.Null,
  message: Schema.String,
}).make({
  init: () => null,
  update: () => null,
  view: (h) =>
    h.main.children(
      h.h1.children('Inspect changes without losing your place'),
      h.p.children(
        'Static package-rendered fixture · mode inspection and chosen-side availability',
      ),
      historyComparisonV2(h, presentation),
      h.div.class('panels').children(
        ...['baseline', 'selected'].map((side) => {
          const context = resolveHistoryChangeNavigatorV2(comparison, side);
          const mode = context.entries.find((entry) => entry.entity === 'mode');
          const focused = resolveHistoryChangeFocusV2(comparison, side, mode.request);
          assert.equal(focused.type, 'ready');
          assert.equal(focused.target.type, 'mode');
          assert.equal('event' in focused.target, false);
          return h.section.class(side).children(
            h.h2.children(side === 'baseline' ? 'Baseline · light' : 'Selected · dark'),
            h.p.class('checkpoint').children(`Checkpoint mode: ${focused.target.connectionMode}`),
            h.p.children('Mode inspection emits no camera request.'),
            historyChangeNavigatorV2(
              h,
              context,
              {
                onFocus: (request) => request.entity,
                onFilter: (kind) => kind,
              },
              { label: `${side} changes` },
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
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>V2 change navigation package fixture</title><style>
body{margin:0;background:#f6f5f2;color:#172126;font:15px/1.5 system-ui}main{max-width:1160px;margin:28px auto}h1{font-size:26px;margin:0}h2{font-size:20px;margin:0}p{margin:10px 0}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:22px}section{padding:24px;border:1px solid #cbd0d4;border-radius:12px;background:white}.selected{background:#192126;color:#e7edf2;border-color:#39434c}.checkpoint{font-weight:700}label{display:inline-flex;gap:5px;margin:12px 14px 8px 0;font-size:14px}ul{padding:0;list-style:none}li{display:grid;gap:8px;border-top:1px solid #ccd2d6;padding:14px 0}button{width:100%;padding:12px;text-align:left;border:1px solid #9caebd;border-radius:7px;background:#f1f5f9;color:#172126;font:inherit}button:disabled{opacity:.55}.selected button{background:#283641;color:#edf3f7}.selected li{border-color:#48545d}li span{font-size:13px}[data-zloz-history-change-v2=mode]{border-color:#3573cb;font-weight:650}[data-zloz-history-mode]{font-weight:650}[role=status]{display:grid;gap:4px}
</style>${output.html}</html>`;
await writeFile(capturePath('history-navigation-v2.html'), html);
const browser = await chromium.launch();
async function capture() {
  const page = await browser.newPage({
    viewport: { width: 1220, height: 800 },
    reducedMotion: 'reduce',
  });
  await page.setContent(html);
  await expect(page.locator('[data-zloz-history-change-v2=mode]')).toHaveCount(2);
  await expect(page.locator('.baseline button:disabled')).toHaveCount(0);
  await expect(page.locator('.selected button:disabled')).toHaveCount(2);
  await expect(page.locator('.baseline .checkpoint')).toHaveText('Checkpoint mode: loose');
  await expect(page.locator('.selected .checkpoint')).toHaveText('Checkpoint mode: strict');
  await expect(page.locator('.selected')).toContainText('absent from the selected edition');
  await page.screenshot({
    path: capturePath('history-navigation-v2.png'),
    fullPage: true,
  });
}
await capture().finally(() => browser.close());
