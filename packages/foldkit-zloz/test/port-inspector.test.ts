import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Option } from 'effect';
import { Window } from 'happy-dom';

import { portInspectorContext, portAdditionContext, portControlReasonId } from '../src/effect-ui';
import { createEditor, updateEditor, type Port } from '../src/index';
import { renderEffectUi } from './render-effect-ui';

const inspect = (...args: Parameters<typeof portInspectorContext>) =>
  Option.getOrUndefined(portInspectorContext(...args));
const additionContext = (...args: Parameters<typeof portAdditionContext>) =>
  Option.getOrUndefined(portAdditionContext(...args));

const state = createEditor({
  nodes: [
    {
      id: 'n',
      label: 'Review',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
    {
      id: 'g',
      label: 'Group',
      kind: 'group',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 200 },
      ports: [],
    },
  ],
  edges: [],
});
const proposal: Port = { id: 'extra', kind: 'output', side: 'right', offset: 0.5 };

test('inspector contexts resolve current capabilities, deletion policy, guards and independent reason IDs', () => {
  const context = inspect(
    state,
    'n',
    {
      canEditPort: ({ operation }) => (operation === 'label' ? 'Managed label' : null),
      canDelete: () => 'Unused port has no attached edges',
    },
    { idPrefix: 'left-pane' },
  );
  const entry = context?.entries[0];
  expect(entry?.endpoint).toEqual({ node: 'n', port: 'in' });
  expect(entry?.labelControl.reason).toBe('Managed label');
  expect(entry?.removeControl.reason).toBeNull();
  expect(entry?.positionControl.reason).toBeNull();
  expect(entry?.labelControl.reasonId).toStartWith('left-pane-');
  expect(
    inspect(state, 'n', {}, { idPrefix: 'right-pane' })?.entries[0]?.labelControl.reasonId,
  ).not.toBe(entry?.labelControl.reasonId);
  expect(inspect(state, 'missing')).toBeUndefined();
  expect(inspect(state, 'g')).toBeUndefined();
  expect(additionContext(state, 'g', proposal)).toBeUndefined();
  expect(
    additionContext(state, 'n', proposal, { canEditPort: () => 'No new ports' })?.control.reason,
  ).toBe('No new ports');
  expect(inspect({ ...state, readOnly: true }, 'n')?.entries[0]?.labelControl.reason).toBe(
    'This diagram is read-only.',
  );
  expect(
    inspect({ ...state, readOnly: true }, 'n', {}, { readOnlyReason: 'Inspection only' })
      ?.entries[0]?.labelControl.reason,
  ).toBe('Inspection only');
  const connected = createEditor({
    nodes: [
      ...state.graph.nodes,
      {
        id: 'source',
        label: 'Source',
        position: { x: 200, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'required',
        source: { node: 'source', port: 'out' },
        target: { node: 'n', port: 'in' },
      },
    ],
  });
  expect(
    inspect(connected, 'n', { canDelete: () => 'Required link' })?.entries[0]?.removeControl.reason,
  ).toBe('Required link');
  const busy = updateEditor(state, { type: 'PanStarted', pointer: 1, point: { x: 0, y: 0 } });
  expect(additionContext(busy, 'n', proposal)?.control.reason).toBe(
    'Finish the current gesture before editing ports.',
  );
});

test('unstyled inspector primitives retain native forms, custom content and associated protection reasons', async () => {
  const entry = inspect(
    state,
    'n',
    { canEditPort: () => 'Managed port' },
    {
      idPrefix: 'inspector',
    },
  )?.entries[0];
  const proposed = additionContext(state, 'n', proposal, { canEditPort: () => 'No new ports' });
  assert(entry && proposed);
  expect(entry.reasons).toHaveLength(1);
  expect(entry.labelControl.reasonId).toBe(entry.removeControl.reasonId);
  const result = await renderEffectUi((h) =>
    h.section.class('custom-layout').children(
      h.button
        .attr('type', 'button')
        .attr('aria-describedby', portControlReasonId(proposed.control))
        .disabled(proposed.control.reason !== null)
        .children('New socket'),
      h.button
        .attr('type', 'button')
        .attr('aria-label', 'Remove in port from Review')
        .attr('aria-describedby', portControlReasonId(entry.removeControl))
        .disabled(entry.removeControl.reason !== null)
        .children('Remove'),
      h.form
        .class('custom-form')
        .on('submit', 'save')
        .children(
          h.input
            .attr('type', 'text')
            .attr('aria-label', 'Custom draft')
            .value('Unsaved label')
            .attr('aria-describedby', portControlReasonId(entry.labelControl))
            .disabled(entry.labelControl.reason !== null),
          h.button
            .attr('type', 'submit')
            .disabled(entry.labelControl.reason !== null)
            .children('Apply'),
          h.button.attr('type', 'button').on('click', 'cancel').children('Discard'),
        ),
      h.span
        .id(entry.labelControl.reasonId)
        .class('custom-badge')
        .children(h.strong.children(entry.labelControl.reason)),
      h.span.id(proposed.control.reasonId).children(proposed.control.reason),
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const document = window.document;
  const input = document.querySelector('input');
  expect(input?.getAttribute('value')).toBe('Unsaved label');
  expect(input?.getAttribute('aria-label')).toBe('Custom draft');
  expect(input?.hasAttribute('disabled')).toBe(true);
  expect(document.getElementById(input?.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
    'Managed port',
  );
  expect(document.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('form button[type="button"]')?.hasAttribute('disabled')).toBe(
    false,
  );
  expect(
    document
      .querySelector('button[aria-label="Remove in port from Review"]')
      ?.hasAttribute('disabled'),
  ).toBe(true);
  expect(document.querySelector('.custom-badge strong')?.textContent).toBe('Managed port');
  expect(document.querySelector('.custom-layout .custom-form')).not.toBeUndefined();
  expect(state.graph.nodes[0]?.ports[0]?.label).toBeUndefined();
});
