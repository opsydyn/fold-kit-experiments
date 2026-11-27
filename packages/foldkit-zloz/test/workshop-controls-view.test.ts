import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { workshopControls, workshopSelect, type ZlozWorkshopViewOptions } from '../src/effect-ui';
import {
  createEditor,
  createEventStormingWorkshopPattern,
  resolveEventStormingWorkshopControls,
} from '../src/index';
async function render(options: ZlozWorkshopViewOptions<string> = {}, protectedEdit = false) {
  const editor = {
    ...createEditor(createEventStormingWorkshopPattern()),
    selectedNodes: ['retry-question'],
  };
  const context = resolveEventStormingWorkshopControls(
    editor,
    'retry-question',
    protectedEdit ? { policy: { canChangeNodeArchitecture: () => 'Facilitator protection' } } : {},
  );
  const TestView = Html.component({
    name: 'SemanticControls',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => workshopControls(h, context, (request) => request.type, options),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const dom = new Window().document;
  dom.body.innerHTML = output.html;
  return dom;
}
test('native workshop controls have labels, selected values and visible policy/kind restrictions', async () => {
  const dom = await render();
  expect(
    dom
      .querySelector('button[aria-label="Set hotspot status to Open question"]')
      ?.getAttribute('aria-pressed'),
  ).toBe('true');
  expect(dom.querySelector('[aria-label="Workshop restrictions"]')?.textContent).toContain('group');
  const locked = await render({}, true);
  expect(
    locked
      .querySelector('button[aria-label="Set hotspot status to Resolved"]')
      ?.hasAttribute('disabled'),
  ).toBe(true);
  expect(locked.body.textContent).toContain('Facilitator protection');
});
test('custom fields, omitted parts and layout retain native selector semantics', async () => {
  const dom = await render({
    renderRole: () => null,
    renderMeaning: () => null,
    renderReasons: () => null,
    renderStatus: (c, h, r) => h.div(workshopSelect(h, c, 'status', r)),
    renderLayout: (parts) => (parts.status ? [parts.status] : []),
  });
  expect(dom.querySelectorAll('select')).toHaveLength(1);
  expect(dom.querySelector('[role="status"]')).toBeNull();
  const omitted = await render({ renderRole: () => null, renderStatus: () => null });
  expect(omitted.querySelectorAll('select')).toHaveLength(0);
});
