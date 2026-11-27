import { expect, test } from 'bun:test';

import { createEventStormingPattern } from '@opsydyn/foldkit-zloz';

import { reviewPacket, reviewPacketDownload, type ReviewPacketOptions } from '../src/effect-ui';
import { resolveReviewPacketControls } from '../src/index';
import { observedRequest, render as renderView, type Request } from './render-effect-ui';

const graph = createEventStormingPattern();
async function render(
  options: ReviewPacketOptions<Request> = {},
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
  return renderView((h) => reviewPacket(h, context, () => observedRequest, options));
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
    renderDiagnostic: (item, h) => h.li.children(h.strong.children('Custom loss badge'), item.side),
    renderDownload: (context, h, onRequest) =>
      reviewPacketDownload(h, context, onRequest, 'Save review'),
    renderLayout: (parts, _context, h) => [
      h.ul.children(...parts.diagnostics),
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
