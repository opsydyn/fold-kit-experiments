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

const initial = createEditor({
  nodes: [
    { id: 'a', label: 'A', position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, ports: [] },
  ],
  edges: [],
});
const state = updateEditor(initial, { type: 'SurfaceMeasured', size: { width: 800, height: 440 } });

test('navigation actions retain Model guards, read-only inspection and current center', () => {
  expect(viewportControlActions(initial).zoomIn.disabled).toBe(true);
  const actions = viewportControlActions({ ...state, readOnly: true });
  expect(actions.zoomIn.event).toEqual({ type: 'Zoomed', point: { x: 400, y: 220 }, factor: 1.25 });
  expect(actions.fitView.disabled).toBe(false);
  expect(
    viewportControlActions({ ...state, viewport: { x: 0, y: 0, zoom: 4 } }).zoomIn.disabled,
  ).toBe(true);
  const nudged = updateEditor(
    { ...state, readOnly: true },
    { type: 'ViewportNudged', delta: { x: -20, y: 0 } },
  );
  expect(nudged.viewport.x).toBe(-20);
  expect(nudged.graph).toBe(state.graph);
  expect(nudged.past).toHaveLength(0);
  const busy = updateEditor(state, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(Object.values(viewportControlActions(busy)).every((action) => action.disabled)).toBe(true);
  expect(updateEditor(busy, { type: 'ViewportNudged', delta: { x: 20, y: 0 } })).toBe(busy);
});

test('navigation primitives compose beside a read-only canvas and are omitted when gated', async () => {
  for (const shown of [true, false]) {
    const result = await renderEffectUi((h) =>
      h.div.children(
        shown
          ? h.aside.children(
              viewportControl(
                h,
                viewportControlActions(state).fitView,
                ({ type }) => type,
              ).children('Host fit'),
              historyMinimap(h, state, ({ type }) => type),
            )
          : null,
        graphSurface(
          h,
          { ...state, readOnly: true },
          {
            id: 'navigation',
            label: 'Navigation',
            wheelNavigation: 'pan',
            onInput: ({ type }) => type,
          },
        ),
      ),
    );
    const { document } = new Window();
    document.body.innerHTML = result.html;
    expect(document.querySelectorAll('[data-flow-surface]')).toHaveLength(1);
    expect(
      document.querySelector('[data-flow-surface]')?.getAttribute('data-flow-wheel-navigation'),
    ).toBe('pan');
    expect(document.querySelectorAll('[data-flow-minimap-viewport]')).toHaveLength(shown ? 1 : 0);
    expect(document.body.textContent.includes('Host fit')).toBe(shown);
  }
});
