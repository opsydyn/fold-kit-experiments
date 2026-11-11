import { expect, test } from 'bun:test';

import { createEventStormingPattern } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozReviewPacketControls,
  zlozReviewPacketDownload,
  type ZlozReviewPacketViewOptions,
} from '../src/foldkit';
import { resolveReviewPacketControls, type ZlozReviewPacketRequest } from '../src/index';
const graph = createEventStormingPattern();
async function render(
  options: ZlozReviewPacketViewOptions<ZlozReviewPacketRequest> = {},
  blockedReason: string | null = null,
) {
  const context = resolveReviewPacketControls(
    {
      id: 'm',
      name: 'Orders',
      origin: null,
      snapshot: { graph },
      editions: [{ id: 'b', name: 'Before', snapshot: { graph } }],
    },
    { baselineId: 'b', selectedId: null },
    { consentKey: null },
    { blockedReason },
  );
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: context }),
        view: (model, h: HtmlBuilder<ZlozReviewPacketRequest>) => ({
          title: 'Review packet',
          body: zlozReviewPacketControls(h, model, (r) => r, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}
test('native scope, side-labelled loss list, checkbox and disabled download expose the consent requirement', async () => {
  const dom = await render();
  expect(dom.querySelector('[aria-label="Review packet scope"]')?.textContent).toContain(
    'Before → Current graph',
  );
  expect(dom.querySelectorAll('li').length).toBeGreaterThan(0);
  expect(dom.querySelector('input[type="checkbox"]')?.hasAttribute('checked')).toBe(false);
  expect(dom.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  expect(dom.querySelector('button')?.getAttribute('aria-description')).toContain('consent');
  const blocked = await render({}, 'Finish the active import');
  expect(blocked.querySelector('input')?.hasAttribute('disabled')).toBe(true);
  expect(blocked.body.textContent).toContain('Finish the active import');
});
test('nullable slots, custom badges/buttons, count-free status and alternate layouts retain protection', async () => {
  const custom = await render({
    showCounts: false,
    renderScope: () => null,
    renderStatus: () => null,
    renderConsent: () => null,
    renderDiagnostic: (item, h) => h.li([], [h.strong([], ['Custom loss badge']), item.side]),
    renderDownload: (context, h, onRequest) =>
      zlozReviewPacketDownload(h, context, onRequest, [], ['Save review'], 'Save review'),
    renderLayout: (parts, _context, h) => [
      h.ul([], parts.diagnostics),
      ...(parts.download ? [parts.download] : []),
    ],
  });
  expect(custom.querySelector('[aria-label="Review packet scope"]')).toBeNull();
  expect(custom.querySelector('input')).toBeNull();
  expect(custom.querySelector('[role="status"]')).toBeNull();
  expect(custom.querySelector('strong')?.textContent).toBe('Custom loss badge');
  expect(custom.querySelector('button')?.textContent).toBe('Save review');
  expect(custom.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  const minimal = await render({ showCounts: false });
  expect(minimal.querySelector('[role="status"]')?.textContent).toBe(
    'Mermaid projections have reported losses.',
  );
});
