import { expect, test } from 'bun:test';

import { Window } from 'happy-dom';

import { graphSurface } from '../src/effect-ui';
import { createEditor } from '../src/index';
import { renderEffectUi } from './render-effect-ui';

test('typed theme tokens and native color scheme are scoped to the requested Zloz root', async () => {
  const state = createEditor({ nodes: [], edges: [] });
  const result = await renderEffectUi((h) =>
    h.div.class('host-pleat-class').children(
      graphSurface(h, state, {
        id: 'themed',
        label: 'Themed',
        theme: {
          colorScheme: 'dark',
          tokens: { background: 'var(--app-surface)' },
        },
        onInput: ({ type }) => type,
      }),
      graphSurface(h, state, { id: 'inherited', label: 'Inherited', onInput: ({ type }) => type }),
    ),
  );
  const { document } = new Window();
  document.body.innerHTML = result.html;
  const themed = document.querySelector('#themed-surface');
  expect(themed?.parentElement?.classList.contains('host-pleat-class')).toBe(true);
  expect(themed?.getAttribute('style')).toContain('color-scheme:dark');
  expect(themed?.getAttribute('style')).toContain('--flow-background:var(--app-surface)');
  expect(themed?.getAttribute('style')).not.toContain('--flow-edge:');
  expect(document.querySelector('#inherited-surface')?.getAttribute('style')).not.toContain(
    '--flow-background:',
  );
});
