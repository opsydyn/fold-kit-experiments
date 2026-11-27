import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import type { GraphSurfaceOptions } from '../src/effect-ui';
import { createEditor, updateEditor } from '../src/index';
import { renderCanvas } from './render-effect-ui';

const initial = createEditor(
  {
    nodes: [
      {
        id: 'g',
        kind: 'group',
        label: 'Group',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 300 },
        ports: [],
      },
      {
        id: 'a',
        parentId: 'g',
        label: 'Child',
        position: { x: 30, y: 60 },
        size: { width: 100, height: 80 },
        ports: [],
      },
    ],
    edges: [],
  },
  { viewport: { x: 35, y: 20, zoom: 2 }, readOnly: true },
);
const state = updateEditor(
  updateEditor(initial, { type: 'SurfaceMeasured', size: { width: 800, height: 440 } }),
  { type: 'GroupCollapseToggled', id: 'g' },
);

async function render(renderWorldOverlay?: GraphSurfaceOptions<string>['renderWorldOverlay']) {
  const result = await renderCanvas(state, { id: 'diagram', renderWorldOverlay });
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('world overlay shares the visible graph transform and receives resolved presentation', async () => {
  const document = await render((nodes, h, context) => {
    expect(nodes.map((node) => node.id)).toEqual(['g']);
    expect(nodes[0]?.size).toEqual({ width: 224, height: 56 });
    expect(context.surface).toEqual({ width: 800, height: 440 });
    expect(context.viewport).toBe(state.viewport);
    expect(context.readOnly).toBe(true);
    return h.div
      .attr('data-flow-world-overlay-item', '')
      .attr('data-flow-no-drag', '')
      .style({
        position: 'absolute',
        left: '24px',
        top: '72px',
        color: 'red',
        pointerEvents: 'auto',
      })
      .children(h.button.attr('type', 'button').children('Domain annotation'));
  });
  const overlay = document.querySelector('[data-flow-world-overlay]');
  const group = document.querySelector('[data-flow-group="g"]');
  expect(overlay?.textContent).toBe('Domain annotation');
  expect(overlay?.parentElement).toBe(group?.parentElement);
  expect(overlay?.parentElement?.getAttribute('style')).toContain('translate(35px, 20px) scale(2)');
  expect(overlay?.getAttribute('style')).toContain('pointer-events:none');
  const item = overlay?.querySelector('[data-flow-world-overlay-item]');
  expect(item?.getAttribute('style')).toContain('left:24px');
  expect(item?.getAttribute('style')).toContain('top:72px');
  expect(item?.getAttribute('style')).toContain('color:red');
  expect(item?.getAttribute('style')).toContain('pointer-events:auto');
  expect(item?.hasAttribute('data-flow-no-drag')).toBe(true);
});

test('omitting the hook or returning null leaves the world layer free of overlays', async () => {
  expect((await render()).querySelector('[data-flow-world-overlay]')).toBeNull();
  expect((await render(() => null)).querySelector('[data-flow-world-overlay]')).toBeNull();
});
