import { expect, test } from 'bun:test';

import { Effect, Option, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  portInspectorContext,
  portAdditionContext,
  zlozPortAddButton,
  zlozPortRemoveButton,
  zlozPortLabelEditButton,
  zlozPortLabelForm,
  zlozPortLabelInput,
  zlozPortLabelSave,
  zlozPortLabelCancel,
  zlozPortProtectionReason,
} from '../src/foldkit';
import { createEditor, updateEditor, type Port, type EditorEvent } from '../src/index';

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
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<string | EditorEvent>) => {
          const context = inspect(
            model,
            'n',
            { canEditPort: () => 'Managed port' },
            { idPrefix: 'inspector' },
          );
          const entry = Option.getOrThrow(Option.fromUndefinedOr(context?.entries[0]));
          expect(entry?.reasons).toHaveLength(1);
          expect(entry?.labelControl.reasonId).toBe(entry?.removeControl.reasonId);
          const addition = additionContext(
            model,
            'n',
            proposal,
            { canEditPort: () => 'No new ports' },
            { idPrefix: 'inspector' },
          );
          const proposed = Option.getOrThrow(Option.fromUndefinedOr(addition));
          const messages = {
            saved: 'saved',
            cancelled: 'cancelled',
            changed: (text: string) => 'draft:' + text,
          };
          return {
            title: 'Custom inspector',
            body: h.section(
              [h.Class('custom-layout')],
              [
                zlozPortAddButton(h, proposed, 'add', [], ['New socket']),
                zlozPortRemoveButton(h, entry, (event) => event, [], ['Remove']),
                zlozPortLabelEditButton(h, entry, 'edit', [], [h.strong([], ['Rename'])]),
                zlozPortLabelForm(
                  h,
                  messages,
                  [h.Class('custom-form')],
                  [
                    zlozPortLabelInput(h, entry, 'Unsaved label', messages.changed, [
                      h.AriaLabel('Custom draft'),
                    ]),
                    zlozPortLabelSave(h, entry, [], ['Apply']),
                    zlozPortLabelCancel(h, messages.cancelled, [], ['Discard']),
                  ],
                ),
                zlozPortProtectionReason(
                  h,
                  entry.labelControl,
                  [h.Class('custom-badge')],
                  [h.strong([], ['Managed port'])],
                ),
                ...entry.reasons
                  .filter(({ reasonId }) => reasonId !== entry.labelControl.reasonId)
                  .map((reason) => zlozPortProtectionReason(h, reason, [])),
                zlozPortProtectionReason(h, proposed.control, []),
              ],
            ),
          };
        },
      },
      { flags: {}, isHydratable: false },
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
