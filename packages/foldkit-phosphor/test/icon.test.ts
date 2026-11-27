import { expect, it } from 'bun:test';

import type { View } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { compilePhosphorIcon } from '../src/compile';
import { phosphorIcon } from '../src/effect-ui';
import { preparePhosphorIcon } from '../src/index';

const source =
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" fill="currentColor" viewBox="0 0 256 256"><path d="M0 0h20v20Z" opacity="0.2"/><g stroke="currentColor" stroke-width="8"><circle cx="16" cy="16" r="8"/></g></svg>';
async function render(view: (h: Html.H<never>) => View.Content<never>) {
  const Icons = Html.component({ name: 'Icons', model: Schema.Null, message: Schema.Never }).make({
    init: () => null,
    update: ($) => $.model,
    view,
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Icons, {}, { static: true }));
  return result.html;
}

it('renders actual SVG geometry with the caller builder, currentColor and duotone opacity', async () => {
  const definition = compilePhosphorIcon(source);
  const markup = await render((h) =>
    h.button.attr('aria-label', 'Add system').children(
      phosphorIcon(h, definition, {
        size: 28,
        colour: 'var(--icon)',
        attributes: { class: 'system-icon' },
      }),
    ),
  );
  expect(markup).toContain('viewBox="0 0 256 256"');
  expect(markup).toContain('width="28"');
  expect(markup).toContain('fill="currentColor"');
  const window = new Window();
  window.document.body.innerHTML = markup;
  expect(window.document.querySelector('svg')?.style.color).toBe('var(--icon)');
  expect(window.document.querySelector('svg')?.getAttribute('class')).toBe('system-icon');
  expect(markup).toContain('d="M0 0h20v20Z"');
  expect(markup).toContain('opacity="0.2"');
  expect(markup).toContain('stroke-width="8"');
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).toContain('focusable="false"');
  expect(markup).not.toContain('role="img"');
});

it('labels standalone artwork without generating global title IDs and mirrors only when requested', async () => {
  const definition = compilePhosphorIcon(source);
  const markup = await render((h) =>
    h.div.children(
      phosphorIcon(h, definition, { label: 'A <system> " & more', mirrored: true, size: '1em' }),
      phosphorIcon(h, definition),
    ),
  );
  expect(markup).toContain('role="img"');
  const window = new Window();
  window.document.body.innerHTML = markup;
  expect(window.document.querySelector('svg')?.getAttribute('aria-label')).toBe(
    'A <system> " & more',
  );
  expect(window.document.querySelector('system')).toBeNull();
  expect(markup).toContain('translate(256 0) scale(-1 1)');
  expect(markup).toContain('width="1em"');
  expect(markup.match(/translate\(256 0\)/g)).toHaveLength(1);
  expect(markup).not.toContain('<title');
});

it('rejects invalid dimensions and empty accessible labels', () => {
  const definition = compilePhosphorIcon(source);
  for (const size of [0, -1, NaN, Infinity, ''])
    expect(() => preparePhosphorIcon(definition, { size })).toThrow(RangeError);
  expect(() => preparePhosphorIcon(definition, { label: ' ' })).toThrow(RangeError);
});

it('rejects active SVG, external resources, entities and malformed input instead of silently dropping it', () => {
  for (const content of [
    '<script>alert(1)</script>',
    '<image href="https://example.org/x"/>',
    '<path onload="alert(1)"/>',
    '<path fill="url(https://example.org/x)"/>',
    '<path fill="u\\72 l(https://example.org/x)"/>',
    '<foreignObject/>',
    '<use href="#x"/>',
    '<path style="fill:red"/>',
  ])
    expect(() => compilePhosphorIcon(`<svg viewBox="0 0 256 256">${content}</svg>`)).toThrow();
  for (const invalid of [
    '',
    '<svg>',
    '<svg viewBox="0 0 24 24"/>',
    '<!DOCTYPE svg><svg viewBox="0 0 256 256"/>',
    '<svg viewBox="0 0 256 256"><path d="&bad;"/></svg>',
  ])
    expect(() => compilePhosphorIcon(invalid)).toThrow();
});

it('compiles independent immutable definitions without a registry or DOM', () => {
  const first = compilePhosphorIcon(source);
  const second = compilePhosphorIcon(source);
  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.children[0]?.attributes)).toBe(true);
});

it('defaults to currentColor even when a static asset omits the SVG fill attribute', async () => {
  const definition = compilePhosphorIcon(
    '<svg viewBox="0 0 256 256"><path d="M0 0h20v20Z"/></svg>',
  );
  expect(await render((h) => phosphorIcon(h, definition))).toContain('fill="currentColor"');
});
