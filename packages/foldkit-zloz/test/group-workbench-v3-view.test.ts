import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozGroupWorkbenchV3, zlozGroupInspectorV3, zlozGroupClipboardV3 } from '../src/foldkit';
import { captureGroupDocumentV3 } from '../src/group-document-v3';
import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
} from '../src/group-workbench-v3';
import { zlozDarkTheme, zlozLightTheme } from '../src/theme';
import wire from './fixtures/group-document-v3-ported.json';
async function render(minimal = false, dark = false, collapsed = false, clipboard = false) {
  let model = createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'render-v3' });
  model = updateGroupWorkbenchV3(model, { type: 'NodeSelected', id: 'g', additive: false });
  if (collapsed) model = updateGroupWorkbenchV3(model, { type: 'GroupCollapseToggled', id: 'g' });
  if (clipboard) model = updateGroupWorkbenchV3(model, { type: 'CopyPressed' });
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model }),
        view: (current, h: HtmlBuilder<ZlozGroupWorkbenchEventV3>) => {
          const options = {
            id: 'native-v3',
            onEvent: (event: ZlozGroupWorkbenchEventV3) => event,
            minimalMode: minimal,
            theme: dark ? zlozDarkTheme : zlozLightTheme,
            policy: { canEditPort: () => 'Published interface is protected.' },
          };
          return {
            title: 'Native v3',
            body: h.div(
              [],
              [
                zlozGroupInspectorV3(h, current, options),
                zlozGroupClipboardV3(h, current, options),
                zlozGroupWorkbenchV3(h, current, options),
              ],
            ),
          };
        },
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('SSR renders authored group ports and accessible native controls with visible protection reasons in minimal mode', async () => {
  const document = await render(true, true);
  expect(document.querySelector('[data-flow-surface]')?.getAttribute('aria-label')).toBe(
    'V3 group editor',
  );
  expect(document.querySelector('[data-flow-owner="g"][data-flow-port="out"]')).not.toBeNull();
  expect(document.body.textContent).toContain('Published interface is protected.');
  expect(
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent === 'Remove port and attached connections' && b.hasAttribute('disabled'),
    ),
  ).toBe(true);
  expect(document.querySelector('path[role="button"]')?.getAttribute('tabindex')).toBe('0');
  expect(document.querySelector('[role="status"]')?.getAttribute('style')).toContain('clip:');
  expect(document.body.innerHTML).toContain('color-scheme: dark');
  expect(
    document.querySelector('[aria-label="V3 modelling controls"]')?.getAttribute('style'),
  ).toContain('--flow-node-background:');
  expect(
    document.querySelector('[aria-label="V3 modelling controls"]')?.getAttribute('style'),
  ).toContain('color-scheme: dark');
});
test('collapsed presentation hides children and preserves the group endpoint without mutating the document', async () => {
  const document = await render(false, false, true);
  expect(document.querySelector('[data-flow-node="child"]')).toBeNull();
  expect(document.querySelector('[data-flow-owner="g"][data-flow-port="out"]')).not.toBeNull();
  expect(document.querySelector('[data-flow-edge="boundary-link"]')).not.toBeNull();
});

test('group fill paints below edges while live shells/ports remain above and do not offset anchors', async () => {
  const document = await render();
  const world = document.querySelector('[data-zloz-group-fill="g"]')?.parentElement;
  expect(world?.children[0]?.getAttribute('data-zloz-group-fill')).toBe('g');
  expect(world?.children[1]?.tagName.toLowerCase()).toBe('svg');
  const shell = document.querySelector('[data-flow-node="g"]');
  expect(shell?.getAttribute('style')).toContain('pointer-events: none');
  expect(shell?.getAttribute('style')).toContain('background: transparent');
  const port = document.querySelector('[data-flow-owner="g"][data-flow-port="out"]');
  expect(port?.getAttribute('style')).toContain('margin: 0');
  expect(port?.getAttribute('style')).toContain('pointer-events: auto');
});

test('composable clipboard controls retain live denial and omission findings in minimal dark mode', async () => {
  const document = await render(true, true, false, true);
  const panel = document.querySelector('[aria-label="V3 clipboard controls"]')!;
  expect(panel.textContent).toContain('crosses the copied selection');
  expect(panel.textContent).toContain('Published interface is protected.');
  expect(panel.textContent).not.toContain('Clipboard state stays');
  const buttons = Array.from(panel.querySelectorAll('button'));
  expect(buttons.find((b) => b.textContent === 'Copy selection')?.disabled).toBe(false);
  expect(buttons.find((b) => b.textContent === 'Paste copy')?.disabled).toBe(true);
});
