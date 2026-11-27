import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import type { InspectedField } from '@opsydyn/effect-three';
import { Effect, Schema } from 'effect';

import { inspectorView } from '../src/index.ts';

const fields: ReadonlyArray<InspectedField> = [
  { _tag: 'Fixed', path: ['_tag'], label: '_tag', text: 'Mesh' },
  { _tag: 'Number', path: ['geometry', 'width'], label: 'width', value: 2 },
  { _tag: 'Text', path: ['key'], label: 'key', value: 'crate' },
  { _tag: 'Toggle', path: ['castShadow'], label: 'castShadow', value: true },
  { _tag: 'Choice', path: ['side'], label: 'side', value: 'back', options: ['front', 'back'] },
  { _tag: 'Colour', path: ['color'], label: 'color', value: 0xff8800 },
  { _tag: 'Vector', path: ['position'], label: 'position', value: [1, 2, 3] },
];

const Inspector = Html.component({
  name: 'InspectorFixture',
  model: Schema.Null,
  message: Schema.Null,
}).make({
  init: () => null,
  update: () => null,
  view: (h) => inspectorView(h, fields, () => null),
});

async function checkInspectorFields() {
  const { html } = await Effect.runPromise(
    HtmlServer.renderToHtml(Inspector, {}, { static: true }),
  );
  expect(html).toContain('<span class="e3-inspector-fixed">Mesh</span>');
  expect(html).toMatch(/<input[^>]+type="number"[^>]+aria-label="geometry width"[^>]+value="2"/);
  expect(html).toMatch(/<input[^>]+type="text"[^>]+aria-label="key"[^>]+value="crate"/);
  expect(html).toMatch(/<input[^>]+type="checkbox"[^>]+aria-label="castShadow"[^>]+checked/);
  expect(html).toMatch(
    /<option[^>]+value="front">front<\/option><option[^>]+value="back"[^>]+selected>back/,
  );
  expect(html).toMatch(/<input[^>]+type="color"[^>]+aria-label="color"[^>]+value="#ff8800"/);
  expect(html).toMatch(/<input[^>]+aria-label="position x"[^>]+value="1"/);
  expect(html).toMatch(/<input[^>]+aria-label="position y"[^>]+value="2"/);
  expect(html).toMatch(/<input[^>]+aria-label="position z"[^>]+value="3"/);
}

test('each field renders its name, accessible control and current value', checkInspectorFields);
