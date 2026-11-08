import { expect, test } from 'bun:test';

import { Effect, Option, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  portPositionDraft,
  updatePortPositionDraft,
  portPositionFromDraft,
  portInspectorContext,
  portPositionEditorContext,
  zlozPortPositionForm,
  zlozPortPositionModeSelect,
  zlozPortPositionSideSelect,
  zlozPortPositionInput,
  zlozPortPositionSave,
  zlozPortPositionCancel,
  zlozPortProtectionReason,
  type ZlozPortPositionDraft,
} from '../src/foldkit';
import { createEditor, updateEditor } from '../src/index';

const port = { id: 'in', kind: 'input', side: 'left', offset: 0.25 } as const;

test('position drafts preserve partial text and convert modes by normalized side geometry', () => {
  const initial = portPositionDraft(port);
  expect(initial).toEqual({ mode: 'offset', side: 'left', offset: '0.25' });
  const partial = updatePortPositionDraft(initial, { type: 'number', field: 'offset', text: '' });
  expect(Option.isNone(portPositionFromDraft(partial))).toBe(true);
  const anchor = updatePortPositionDraft(initial, { type: 'mode', mode: 'anchor' });
  expect(anchor).toEqual({ mode: 'anchor', side: 'left', x: '0', y: '0.25' });
  const moved = updatePortPositionDraft(anchor, { type: 'number', field: 'x', text: '0.3' });
  expect(Option.getOrThrow(portPositionFromDraft(moved))).toEqual({
    side: 'left',
    anchor: { x: 0.3, y: 0.25 },
  });
  const side = updatePortPositionDraft(moved, { type: 'side', side: 'top' });
  expect(updatePortPositionDraft(side, { type: 'mode', mode: 'offset' })).toEqual({
    mode: 'offset',
    side: 'top',
    offset: '0.3',
  });
  expect(initial).toEqual({ mode: 'offset', side: 'left', offset: '0.25' });
  for (const value of ['', ' ', 'NaN', 'Infinity', '-0.1', '1.1']) {
    expect(
      Option.isNone(portPositionFromDraft({ mode: 'offset', side: 'right', offset: value })),
    ).toBe(true);
  }
  expect(
    Option.isNone(portPositionFromDraft({ mode: 'anchor', side: 'top', x: '', y: '0.5' })),
  ).toBe(true);
  expect(
    Option.isNone(portPositionFromDraft({ mode: 'anchor', side: 'top', x: '0.5', y: '2' })),
  ).toBe(true);
  for (const value of ['0', '1', '0.333', '1e-1']) {
    expect(
      Option.isSome(portPositionFromDraft({ mode: 'offset', side: 'right', offset: value })),
    ).toBe(true);
  }
  for (const [side, x, y] of [
    ['right', '1', '0.25'],
    ['top', '0.25', '0'],
    ['bottom', '0.25', '1'],
  ] as const) {
    expect(
      updatePortPositionDraft(portPositionDraft({ ...port, side }), {
        type: 'mode',
        mode: 'anchor',
      }),
    ).toEqual({ mode: 'anchor', side, x, y });
  }
});

test('saving a complete position draft retains endpoint identity and uses one protected undo transaction', () => {
  const graph = {
    nodes: [
      {
        id: 'n',
        label: 'N',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [port],
      },
    ],
    edges: [],
  };
  const initial = createEditor(graph);
  const draft: ZlozPortPositionDraft = { mode: 'anchor', side: 'bottom', x: '0.2', y: '0.9' };
  const position = Option.getOrThrow(portPositionFromDraft(draft));
  const event = {
    type: 'PortPositionsChanged',
    positions: [{ endpoint: { node: 'n', port: 'in' }, position }],
  } as const;
  const blocked = updateEditor(initial, event, { canEditPort: () => 'Managed anchor' });
  expect(blocked.graph).toBe(initial.graph);
  expect(blocked.notice).toBe('Managed anchor');
  const saved = updateEditor(initial, event);
  expect(saved.graph.nodes[0]?.ports[0]).toEqual({
    id: 'in',
    kind: 'input',
    side: 'bottom',
    anchor: { x: 0.2, y: 0.9 },
  });
  expect(saved.past).toHaveLength(1);
  expect(updateEditor(saved, { type: 'UndoPressed' }).graph).toEqual(initial.graph);
});

test('native position inputs retain normalized constraints, custom styling and current policy reasons', async () => {
  const state = createEditor({
    nodes: [
      {
        id: 'n',
        label: 'N',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [port],
      },
    ],
    edges: [],
  });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<string>) => {
          const entry = Option.getOrThrow(
            Option.flatMap(
              portInspectorContext(model, 'n', {
                canEditPort: ({ operation }) =>
                  operation === 'position' ? 'Managed anchors' : null,
              }),
              (context) => Option.fromUndefinedOr(context.entries[0]),
            ),
          );
          const context = portPositionEditorContext(entry, {
            mode: 'anchor',
            side: 'left',
            x: '0.2',
            y: '0.9',
          });
          return {
            title: 'Position fields',
            body: zlozPortPositionForm(
              h,
              { saved: 'save', cancelled: 'cancel' },
              [],
              [
                zlozPortPositionModeSelect(h, context, () => 'mode', []),
                zlozPortPositionSideSelect(h, context, () => 'side', []),
                ...context.inputs.map((input) =>
                  zlozPortPositionInput(h, context, input, () => 'number', [
                    h.Class('custom-position-field'),
                  ]),
                ),
                zlozPortPositionSave(h, context, [], ['Save']),
                zlozPortPositionCancel(h, 'cancel', [], ['Cancel']),
                ...entry.reasons.map((reason) => zlozPortProtectionReason(h, reason, [])),
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
  const inputs = document.querySelectorAll('input');
  expect(inputs).toHaveLength(2);
  expect([...inputs].map((input) => input.getAttribute('value'))).toEqual(['0.2', '0.9']);
  for (const input of inputs) {
    expect(input.type).toBe('number');
    expect(input.min).toBe('0');
    expect(input.max).toBe('1');
    expect(input.step).toBe('any');
    expect(input.required).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.className).toBe('custom-position-field');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Managed anchors',
    );
  }
  expect(document.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('button[type="button"]')?.hasAttribute('disabled')).toBe(false);
});
