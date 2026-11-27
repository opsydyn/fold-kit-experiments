import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  groupSurfaceV3,
  groupInspectorV3,
  groupClipboardV3,
  type GroupSurfaceOptionsV3,
} from '../src/effect-ui';
import { captureGroupDocumentV3 } from '../src/group-document-v3';
import {
  createGroupWorkbenchV3,
  updateGroupWorkbenchV3,
  type ZlozGroupWorkbenchEventV3,
} from '../src/group-workbench-v3';
import { zlozDarkTheme, zlozLightTheme } from '../src/theme';
import wire from './fixtures/group-document-v3-ported.json';
async function render(
  minimal = false,
  dark = false,
  collapsed = false,
  clipboard = false,
  presentation: Partial<GroupSurfaceOptionsV3<string>> = {},
) {
  let model = createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'render-v3' });
  model = updateGroupWorkbenchV3(model, { type: 'NodeSelected', id: 'g', additive: false });
  if (collapsed) model = updateGroupWorkbenchV3(model, { type: 'GroupCollapseToggled', id: 'g' });
  if (clipboard) model = updateGroupWorkbenchV3(model, { type: 'CopyPressed' });
  const View = Html.component({
    name: 'GroupWorkbenchV3',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => {
      const options = {
        id: 'native-v3',
        onEvent: (event: ZlozGroupWorkbenchEventV3) => event.type,
        minimalMode: minimal,
        theme: dark ? zlozDarkTheme : zlozLightTheme,
        policy: { canEditPort: () => 'Published interface is protected.' },
        ...presentation,
      };
      return h.div.children(
        groupInspectorV3(h, model, options),
        groupClipboardV3(h, model, options),
        groupSurfaceV3(h, model, options),
      );
    },
  });
  const markup = HtmlServer.renderToHtml(View, {}, { static: true });
  const output = await Effect.runPromise(markup);
  const window = new Window();
  const style = window.document.createElement('style');
  style.textContent = readFileSync(new URL('../src/effect-ui.css', import.meta.url), 'utf8');
  window.document.head.append(style);
  window.document.body.innerHTML = output.html;
  return window;
}

test('SSR renders authored group ports and accessible native controls with visible protection reasons in minimal mode', async () => {
  const { document } = await render(true, true);
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
  expect(document.body.innerHTML).toContain('color-scheme:dark');
  expect(
    document.querySelector('[aria-label="V3 modelling controls"]')?.getAttribute('style'),
  ).toContain('--flow-node-background:');
  expect(
    document.querySelector('[aria-label="V3 modelling controls"]')?.getAttribute('style'),
  ).toContain('color-scheme:dark');
});
test('collapsed presentation hides children and preserves the group endpoint without mutating the document', async () => {
  const { document } = await render(false, false, true);
  expect(document.querySelector('[data-flow-node="child"]')).toBeNull();
  expect(document.querySelector('[data-flow-owner="g"][data-flow-port="out"]')).not.toBeNull();
  expect(document.querySelector('[data-flow-edge="boundary-link"]')).not.toBeNull();
});

test('group fill paints below edges while live shells/ports remain above and do not offset anchors', async () => {
  const window = await render();
  const { document } = window;
  const world = document.querySelector('[data-zloz-group-fill="g"]')?.parentElement;
  expect(world?.children[0]?.getAttribute('data-zloz-group-fill')).toBe('g');
  expect(world?.children[1]?.tagName.toLowerCase()).toBe('svg');
  const shell = document.querySelector('[data-flow-node="g"]')!;
  const port = document.querySelector('[data-flow-owner="g"][data-flow-port="out"]')!;
  expect(window.getComputedStyle(shell).pointerEvents).toBe('none');
  expect(window.getComputedStyle(shell).background).toBe('transparent');
  expect(window.getComputedStyle(port).margin).toBe('0px');
  expect(window.getComputedStyle(port).pointerEvents).toBe('auto');
});

test('composable clipboard controls retain live denial and omission findings in minimal dark mode', async () => {
  const { document } = await render(true, true, false, true);
  const panel = document.querySelector('[aria-label="V3 clipboard controls"]')!;
  expect(panel.textContent).toContain('crosses the copied selection');
  expect(panel.textContent).toContain('Published interface is protected.');
  expect(panel.textContent).not.toContain('Clipboard state stays');
  const buttons = Array.from(panel.querySelectorAll('button'));
  expect(buttons.find((b) => b.textContent === 'Copy selection')?.disabled).toBe(false);
  expect(buttons.find((b) => b.textContent === 'Paste copy')?.disabled).toBe(true);
});

test('custom presentation keeps scoped input, accessible controls and live policy reasons', async () => {
  const window = await render(false, false, false, false, {
    renderNode: (node, _selected, h) => h.p(`Details: ${node.id}`),
    renderPort: (_node, port, h) => h.span(`Socket: ${port.id}`),
    renderEdge: (edge, _geometry, h) => h.el('text').children(`Edge: ${edge.id}`),
    renderControls: (_model, h) => h.p('Custom group controls'),
    renderResize: (_node, _reason, h) => h.span('Custom resize'),
    renderPortAnchor: (node, port, reason, h) =>
      h.span(`Anchor: ${node.id}/${port.id} ${reason ?? ''}`),
    boxSelection: false,
    pinchZoom: false,
  });
  const { document } = window;
  const surface = document.querySelector('[data-flow-surface]');
  expect(surface?.getAttribute('data-flow-box-selection')).toBeNull();
  expect(surface?.getAttribute('data-flow-pinch-zoom')).toBeNull();
  expect(surface?.querySelector('[data-flow-handle="g"]')?.textContent).toBeTruthy();
  expect(surface?.querySelector('[data-flow-owner="g"][data-flow-port="out"]')?.textContent).toBe(
    'Socket: out',
  );
  expect(surface?.querySelector('[data-flow-edge="boundary-link"]')?.getAttribute('role')).toBe(
    'button',
  );
  expect(surface?.querySelector('svg text')?.textContent).toBe('Edge: boundary-link');
  const anchor = surface?.querySelector('[data-flow-anchor-node="g"]');
  expect(anchor?.hasAttribute('disabled')).toBe(true);
  expect(anchor?.textContent).toContain('Published interface is protected.');
  expect(surface?.querySelector('[data-flow-resize="g"]')?.textContent).toBe('Custom resize');
  expect(surface?.textContent).toContain('Details: g');
  expect(document.body.textContent).toContain('Custom group controls');
});
