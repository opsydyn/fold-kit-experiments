import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { createEditor, updateEditor } from '../src/editor';
import { graphSurface } from '../src/effect-ui';

test('native resize handles follow live resize and selection policy', async () => {
  const editor = createEditor({
    nodes: [
      {
        id: 'open',
        label: 'Open',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
      {
        id: 'locked',
        label: 'Locked',
        position: { x: 200, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
      {
        id: 'group',
        kind: 'group',
        label: 'Group',
        position: { x: 400, y: 0 },
        size: { width: 150, height: 120 },
        ports: [],
      },
    ],
    edges: [],
  });
  const selected = updateEditor(editor, { type: 'NodeSelected', id: 'group', additive: false });
  const component = Html.component({
    name: 'NativeResizePolicy',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, selected, {
        id: 'native-resize-policy',
        label: 'Resize policy',
        resizeHandles: true,
        onInput: ({ type }) => type,
        policy: {
          canResizeNode: ({ id }) => (id === 'locked' ? 'Size is protected.' : null),
          canSelectNode: ({ id }) => (id === 'group' ? 'The selection was revoked.' : null),
        },
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  expect(document.querySelector('[data-flow-resize="open"]')?.getAttribute('aria-label')).toBe(
    'Resize Open',
  );
  expect(document.querySelector('[data-flow-resize="locked"]')).toBeNull();
  expect(document.querySelector('[data-flow-resize="group"]')).toBeNull();
});
