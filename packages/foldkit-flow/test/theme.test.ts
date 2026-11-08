import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView } from '../src/foldkit';
import { createEditor, type EditorEvent } from '../src/index';

test('typed theme tokens and native color scheme are scoped to the requested Flow root', async () => {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: createEditor({ nodes: [], edges: [] }) }),
        view: (state, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Flow themes',
          body: h.div(
            [],
            [
              flowView(h, state, {
                id: 'themed',
                label: 'Themed',
                themeClassName: 'host-pleat-class',
                theme: { colorScheme: 'dark', tokens: { background: 'var(--app-surface)' } },
                onEvent: (event) => event,
              }),
              flowView(h, state, {
                id: 'inherited',
                label: 'Inherited',
                themeClassName: 'host-pleat-class',
                onEvent: (event) => event,
              }),
            ],
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const { document } = new Window();
  document.body.innerHTML = result.html;
  const themed = document.querySelector('#themed');
  expect(themed?.classList.contains('host-pleat-class')).toBe(true);
  expect(themed?.getAttribute('style')).toContain('color-scheme: dark');
  expect(themed?.getAttribute('style')).toContain('--flow-background: var(--app-surface)');
  expect(themed?.getAttribute('style')).not.toContain('--flow-edge:');
  expect(document.querySelector('#inherited')?.hasAttribute('style')).toBe(false);
});
