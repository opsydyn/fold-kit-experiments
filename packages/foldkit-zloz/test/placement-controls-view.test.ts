import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { placementPalette, placementHost, placementPreview } from '../src/effect-ui';
import {
  createEditor,
  createPlacement,
  createArchitecturePattern,
  resolvePlacementControls,
  updatePlacementControls,
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
  const Palette = Html.component({
    name: 'Palette',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      placementHost(h, controls, (input) => input.type).children(
        placementPalette(h, controls, (input) => input.type, {
          instructions: !minimal,
          measurements: !minimal,
          entryClass: custom ? 'custom-card' : undefined,
          renderEntry: custom ? (entry, h) => h.span(`Custom card: ${entry.label}`) : undefined,
          renderStatus: custom ? () => null : undefined,
        }),
        placementPreview(h, controls),
      ),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(Palette, {}, { static: true }));
  const window = new Window();
  const style = window.document.createElement('style');
  style.textContent = await Bun.file(new URL('../src/effect-ui.css', import.meta.url)).text();
  window.document.head.append(style);
  window.document.body.innerHTML = output.html;
  return window;
}
test('native/custom cards share protection and delegated input while minimal mode omits diagnostics', async () => {
  const nativeWindow = await render();
  const native = nativeWindow.document;
  const frame = native.querySelector('[data-zloz-palette-frame]');
  if (frame)
    expect(nativeWindow.getComputedStyle(frame).getPropertyValue('touch-action')).toBe('none');
  expect(native.querySelector('[data-zloz-palette-entry]')?.tagName).toBe('BUTTON');
  expect(native.querySelector('[data-zloz-palette-entry]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(native.querySelector('[data-zloz-placement-preview]')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
  expect(native.querySelector('[data-zloz-placement-readout]')).not.toBeNull();
  expect(native.querySelector('[data-zloz-placement-status]')).not.toBeNull();
  const { document: custom } = await render(true, true, true);
  expect(custom.querySelector('.custom-card')?.hasAttribute('disabled')).toBe(true);
  expect(custom.querySelector('.custom-card')?.textContent).toBe('Custom card: C4 context');
  expect(custom.querySelector('[data-zloz-placement-status]')).toBeNull();
  expect(custom.querySelector('.custom-card')?.getAttribute('aria-label')).toBe('C4 context');
  expect(custom.body.textContent).toContain('Governed source');
  expect(custom.querySelector('[data-zloz-placement-readout]')).toBeNull();
  expect(custom.body.textContent).not.toContain('Shift accelerates');
  expect(
    custom.querySelector('[data-zloz-placement-action="cancel"]')?.hasAttribute('disabled'),
  ).toBe(false);
});
