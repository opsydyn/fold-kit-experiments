import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozPalette,
  zlozPaletteEntry,
  zlozPlacementHost,
  zlozPlacementPreview,
} from '../src/foldkit';
import {
  createEditor,
  createPlacement,
  createArchitecturePattern,
  resolvePlacementControls,
  updatePlacementControls,
  type ZlozPlacementInput,
} from '../src/index';
async function render(custom = false, minimal = false, protectedEntry = false) {
  const entries = [
    {
      id: 'card',
      label: 'C4 context',
      intent: {
        source: { type: 'palette' as const, id: 'card' },
        fragment: createArchitecturePattern('c4-context'),
        anchor: { x: 0, y: 0 },
      },
    },
  ];
  const context = {
    scope: 'sample',
    editor: { ...createEditor({ nodes: [], edges: [] }), surface: { width: 800, height: 600 } },
  };
  const state = updatePlacementControls(createPlacement('sample'), context, entries, {
    type: 'PaletteEntryActivated',
    scope: 'sample',
    generation: 0,
    id: 'card',
  }).placement;
  const controls = resolvePlacementControls(
    state,
    context,
    entries,
    protectedEntry ? { canStartPlacement: () => 'Governed source' } : {},
  );
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: controls }),
        view: (model, h: HtmlBuilder<ZlozPlacementInput>) => ({
          title: 'Palette',
          body: zlozPlacementHost(
            h,
            model,
            (input) => input,
            [],
            [
              zlozPalette(h, model, (input) => input, {
                diagnostics: { instructions: !minimal, measurements: !minimal },
                renderEntry: (entry, builder) =>
                  custom
                    ? zlozPaletteEntry(
                        builder,
                        entry,
                        [builder.Class('custom-card')],
                        ['Custom card'],
                      )
                    : undefined,
              }),
              zlozPlacementPreview(h, model) ?? h.span([], []),
            ],
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native/custom cards share protection and delegated input while minimal mode omits diagnostics', async () => {
  const native = await render();
  expect(native.querySelector('[data-zloz-palette-entry]')?.tagName).toBe('BUTTON');
  expect(native.querySelector('[data-zloz-palette-entry]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(native.querySelector('[data-zloz-placement-preview]')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
  expect(native.querySelector('[data-zloz-placement-readout]')).not.toBeNull();
  const custom = await render(true, true, true);
  expect(custom.querySelector('.custom-card')?.hasAttribute('disabled')).toBe(true);
  expect(custom.querySelector('[data-zloz-palette-frame]')?.getAttribute('style')).toContain(
    'touch-action: none',
  );
  expect(custom.querySelector('.custom-card')?.getAttribute('aria-label')).toBe('C4 context');
  expect(custom.body.textContent).toContain('Governed source');
  expect(custom.querySelector('[data-zloz-placement-readout]')).toBeNull();
  expect(custom.body.textContent).not.toContain('Shift accelerates');
  expect(
    custom.querySelector('[data-zloz-placement-action="cancel"]')?.hasAttribute('disabled'),
  ).toBe(false);
});
