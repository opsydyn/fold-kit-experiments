import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { groupInspectorV3, groupSurfaceV3 } from '../src/effect-ui';
import { captureGroupDocumentV3 } from '../src/group-document-v3';
import { createGroupWorkbenchV3, updateGroupWorkbenchV3 } from '../src/group-workbench-v3';
import wire from './fixtures/group-document-v3-ported.json';

test('native v3 surface projects collapsed groups and preserves authored ports and protection', async () => {
  const created = createGroupWorkbenchV3(captureGroupDocumentV3(wire), { sessionId: 'ssr' });
  const selected = updateGroupWorkbenchV3(created, {
    type: 'NodeSelected',
    id: 'g',
    additive: false,
  });
  const collapsed = updateGroupWorkbenchV3(selected, { type: 'GroupCollapseToggled', id: 'g' });
  const component = Html.component({
    name: 'GroupSurfaceSsr',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) => {
      const options = {
        id: 'native-v3-test',
        minimalMode: true,
        policy: {
          canEditPort: () => 'Published interface is protected.',
          canResizeNode: () => 'Published bounds are protected.',
        },
        onEvent: ({ type }: Parameters<typeof updateGroupWorkbenchV3>[1]) => type,
      };
      return h.div(groupSurfaceV3(h, collapsed, options), groupInspectorV3(h, collapsed, options));
    },
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const world = document.querySelector('[data-zloz-group-fill="g"]')?.parentElement;
  expect(world?.children[0]?.getAttribute('data-zloz-group-fill')).toBe('g');
  expect(world?.children[1]?.tagName.toLowerCase()).toBe('svg');
  expect(document.querySelector('[data-flow-node="child"]')).toBeNull();
  expect(document.querySelector('[data-flow-owner="g"][data-flow-port="out"]')).not.toBeNull();
  expect(document.querySelector('[data-flow-edge="boundary-link"]')?.getAttribute('tabindex')).toBe(
    '0',
  );
  expect(document.querySelector('[data-flow-resize="g"]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('[data-flow-anchor-node="g"]')?.hasAttribute('disabled')).toBe(
    true,
  );
  expect(document.body.textContent).toContain('Published interface is protected.');
  expect(document.body.textContent).toContain('Published bounds are protected.');
  const inspector = document.querySelector('[aria-label="V3 modelling controls"]');
  const remove = Array.from(inspector?.querySelectorAll('button') ?? []).find(
    (button) => button.textContent === 'Remove port and attached connections',
  );
  expect(remove?.disabled).toBe(true);
  expect(inspector?.textContent).toContain('Published interface is protected.');
  expect(collapsed.editor.document.graph.nodes.some(({ id }) => id === 'child')).toBe(true);
});
