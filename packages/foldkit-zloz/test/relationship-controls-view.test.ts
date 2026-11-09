import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozEventStormingRelationshipControls,
  zlozEventStormingRelationshipSelect,
  zlozEventStormingRelationshipInference,
  type ZlozEventStormingRelationshipControlsViewOptions,
} from '../src/foldkit';
import {
  createEditor,
  createEventStormingPattern,
  updateEditor,
  eventStormingRelationshipPolicy,
  resolveEventStormingRelationshipControls,
  type ZlozEventStormingRelationshipRequest,
  type ZlozEventStormingRelationshipControlsContext,
} from '../src/index';
const editor = createEditor(createEventStormingPattern({ includeAggregate: true }));
const context = resolveEventStormingRelationshipControls(editor, 'step:0', {
  policy: eventStormingRelationshipPolicy(),
});
async function render(
  value: ZlozEventStormingRelationshipControlsContext = context,
  options: ZlozEventStormingRelationshipControlsViewOptions<ZlozEventStormingRelationshipRequest> = {},
) {
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: value }),
        view: (model, h: HtmlBuilder<ZlozEventStormingRelationshipRequest>) => ({
          title: 'Relationships',
          body: zlozEventStormingRelationshipControls(h, model, (request) => request, options),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
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
        [],
        [
          zlozEventStormingRelationshipSelect(h, value, onRequest, [h.Class('designer-select')]),
          'Custom chooser',
        ],
      ),
    renderInference: (action, h, onRequest) =>
      zlozEventStormingRelationshipInference(h, action, onRequest, [], ['Custom inference']),
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
