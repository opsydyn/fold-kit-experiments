import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  eventStormingRelationshipControls,
  eventStormingRelationshipSelect,
  eventStormingRelationshipInference,
  type ZlozEventStormingRelationshipControlsViewOptions,
} from '../src/effect-ui';
import {
  createEditor,
  createEventStormingPattern,
  updateEditor,
  eventStormingRelationshipPolicy,
  resolveEventStormingRelationshipControls,
  type ZlozEventStormingRelationshipControlsContext,
} from '../src/index';
const editor = createEditor(createEventStormingPattern({ includeAggregate: true }));
const context = resolveEventStormingRelationshipControls(editor, 'step:0', {
  policy: eventStormingRelationshipPolicy(),
});
async function render(
  value: ZlozEventStormingRelationshipControlsContext = context,
  options: ZlozEventStormingRelationshipControlsViewOptions<string> = {},
) {
  const TestView = Html.component({
    name: 'SemanticControls',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) => eventStormingRelationshipControls(h, value, (request) => request.type, options),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(TestView, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('native controls expose names, guarded choices, explicit inference and visible diagnostic reasons', async () => {
  const document = await render();
  expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
    'Causal relationship controls',
  );
  expect(document.querySelector('select')?.getAttribute('aria-label')).toBe(
    'Causal relationship type',
  );
  expect(document.querySelector('option[value="emits"]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('button')?.getAttribute('type')).toBe('button');
  expect(document.querySelector('button')?.getAttribute('aria-label')).toBe(
    'Apply inferred relationship',
  );
  expect(document.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('button')?.getAttribute('aria-description')).toContain(
    'already has explicit meaning',
  );
  expect(
    document.querySelector('[aria-label="Relationship compatibility"]')?.textContent,
  ).toContain('does not allow');
  expect(document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  expect(
    document.querySelector('[aria-label="Relationship compatibility"]')?.getAttribute('role'),
  ).toBe('group');
});
test('unfamiliar current values remain visible and no-edge/read-only contexts cannot dispatch edits', async () => {
  const custom = updateEditor(editor, {
    type: 'EdgeArchitectureChanged',
    id: 'step:0',
    architecture: { family: 'event-storming', role: 'custom', name: 'outside' },
  });
  const document = await render(resolveEventStormingRelationshipControls(custom, 'step:0'));
  expect(document.querySelector('option[selected]')?.getAttribute('value')).toBe('custom:outside');
  expect(document.querySelector('option[value="custom:outside"]')?.hasAttribute('disabled')).toBe(
    true,
  );
  const empty = await render(resolveEventStormingRelationshipControls(editor, null));
  expect(empty.querySelector('select')?.hasAttribute('disabled')).toBe(true);
  const readonly = await render(
    resolveEventStormingRelationshipControls({ ...editor, readOnly: true }, 'step:0'),
  );
  expect(readonly.querySelector('select')?.getAttribute('aria-description')).toContain('read-only');
});
test('native helpers compose in custom shells and nullable parts/layout omit default chrome', async () => {
  const document = await render(context, {
    renderSelect: (value, h, onRequest) =>
      h.label(
        eventStormingRelationshipSelect(h, value, onRequest, 'designer-select'),
        'Custom chooser',
      ),
    renderInference: (action, h, onRequest) =>
      eventStormingRelationshipInference(h, action, onRequest, ['Custom inference']),
    renderStatus: () => null,
    renderReasons: () => null,
    renderLayout: (parts) => [
      ...(parts.inference ? [parts.inference] : []),
      ...(parts.select ? [parts.select] : []),
    ],
  });
  expect(document.querySelector('select')?.getAttribute('class')).toBe('designer-select');
  expect(document.querySelector('button')?.textContent).toBe('Custom inference');
  expect(document.querySelector('button')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('[role="status"]')).toBeNull();
  expect(document.querySelector('[aria-label="Relationship compatibility"]')).toBeNull();
  const omitted = await render(context, { renderSelect: () => null, renderInference: () => null });
  expect(omitted.querySelectorAll('select,button')).toHaveLength(0);
});
