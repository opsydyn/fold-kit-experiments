import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import {
  graphSurface,
  historyMinimap,
  viewportControl,
  viewportControlActions,
} from '../src/effect-ui';
import { createEditor, updateEditor } from '../src/index';
import { renderEffectUi } from './render-effect-ui';
const state = updateEditor(
  createEditor({
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  }),
  { type: 'SurfaceMeasured', size: { width: 800, height: 440 } },
);

test('public layout moves native chrome without duplicating the canvas and fill has a bounded sizing contract', async () => {
  const result = await renderEffectUi((h) =>
    h.div.class('custom-layout').children(
      h.aside.attr('aria-label', 'Tools').children(
        h.div
          .attr('aria-label', 'Viewport controls')
          .children(viewportControl(h, viewportControlActions(state).fitView, ({ type }) => type)),
        historyMinimap(h, state, ({ type }) => type),
      ),
      h.main.style({ height: '100%' }).children(
        graphSurface(h, state, {
          id: 'layout',
          label: 'Canvas',
          onInput: ({ type }) => type,
        }),
      ),
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  expect(window.document.querySelectorAll('[data-flow-surface]')).toHaveLength(1);
  expect(window.document.querySelector('main')?.getAttribute('style')).toContain('height:100%');
  expect(window.document.querySelector('main [data-flow-surface]')?.id).toBe('layout-surface');
  expect(window.document.querySelectorAll('[data-flow-minimap]')).toHaveLength(1);
  expect(window.document.querySelector('aside [data-flow-minimap]')).not.toBeNull();
  expect(window.document.querySelector('main [data-flow-minimap]')).toBeNull();
  expect(window.document.querySelector('aside [data-flow-surface]')).toBeNull();
  expect(window.document.querySelector('aside [aria-label="Viewport controls"]')).not.toBeNull();
});
