import { expect, test } from 'bun:test';

import {
  createEditor,
  resolveConnectionCreation,
  resolveEdgeReconnection,
  serializeGraph,
  parseGraph,
  updateEditor,
} from '@opsydyn/foldkit-flow';
import type { HtmlBuilder } from 'foldkit/html';

import { workbenchPolicy } from '../src/editor/editor-policy';
import { createProtectedWorkflowGraph } from '../src/editor/large-workflow';
import type { Message as WorkbenchMessage } from '../src/editor/message';
import { init } from '../src/editor/model';

const endpoint = (node: string, port: string) => ({ node, port });

test('protected fixture has mixed real input/output guards and persists them without removing existing edges', () => {
  const graph = createProtectedWorkflowGraph();
  expect(graph.nodes).toHaveLength(320);
  expect(graph.edges).toHaveLength(452);
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  const model = { ...init().model, editor: createEditor(graph), mixedPortProtection: true };
  const policy = workbenchPolicy(model);
  expect(
    graph.nodes.filter((node) => policy.canConnectPort?.(endpoint(node.id, 'in'), graph) != null),
  ).toHaveLength(80);
  expect(
    graph.nodes.filter((node) => policy.canConnectPort?.(endpoint(node.id, 'out'), graph) != null),
  ).toHaveLength(60);
  expect(policy.canConnectPort?.(endpoint('load-1-1', 'out'), graph)).toBeNull();
  expect(policy.canConnectPort?.(endpoint('load-1-2', 'in'), graph)).toBe(
    'Approval required for this input.',
  );
  expect(policy.canConnectPort?.(endpoint('load-1-4', 'out'), graph)).toBe(
    'Output reserved for automation.',
  );
  expect(model.editor.graph.edges).toHaveLength(452);
});

test('creation and reconnection preflight agree with commit rejection and fresh policy toggles', () => {
  const graph = createProtectedWorkflowGraph();
  const state = { ...createEditor(graph), connection: endpoint('load-1-1', 'out') };
  const model = { ...init().model, editor: state, mixedPortProtection: true };
  const policy = workbenchPolicy(model);
  const target = resolveConnectionCreation(state, policy).target.entries.find(
    ({ endpoint }) => endpoint.node === 'load-1-6',
  )!;
  expect(target.reason).toBe('Approval required for this input.');
  const refused = updateEditor(state, target.event, policy);
  expect(refused.graph).toBe(state.graph);
  expect(refused.past).toBe(state.past);
  expect(refused.notice).toBe(target.reason);
  const relaxed = workbenchPolicy({ ...model, mixedPortProtection: false });
  expect(
    resolveConnectionCreation(state, relaxed).target.entries.find(
      ({ value }) => value === target.value,
    )?.reason,
  ).toBeNull();
  const created = updateEditor(state, target.event, relaxed);
  expect(created.graph.edges).toHaveLength(453);
  expect(updateEditor(created, { type: 'UndoPressed' }).graph).toEqual(state.graph);
  const reconnect = resolveEdgeReconnection(state, 'load-1-1:next', 'target', policy)!;
  const choice = reconnect.entries.find(({ endpoint }) => endpoint.node === 'load-1-6')!;
  expect(choice.reason).toBe(target.reason);
  expect(updateEditor(state, choice.event, policy).notice).toBe(target.reason);
});

test('example preset enables Orbit composition and controls without changing authored connections', async () => {
  const { Message } = await import('../src/editor/message');
  const { update } = await import('../src/editor/update');
  const opened = update(
    init().model,
    Message.SelectedExample({ example: 'protected-orbits' }),
  ).model;
  expect(opened.nodeDesign).toBe('orbits');
  expect(
    opened.retainNodeViews &&
      opened.customPorts &&
      opened.socketReasonBadges &&
      opened.mixedPortProtection,
  ).toBe(true);
  expect(opened.editor.graph.edges).toHaveLength(452);
  const staged = {
    ...opened,
    editor: updateEditor(
      opened.editor,
      { type: 'PortActivated', endpoint: endpoint('load-1-1', 'out') },
      workbenchPolicy(opened),
    ),
  };
  const hidden = update(staged, Message.ClickedSocketReasonBadges()).model;
  expect(hidden.editor).toBe(staged.editor);
  const relaxed = update(staged, Message.ClickedMixedPortProtection()).model;
  expect(relaxed.editor.connection).toBeNull();
  expect(relaxed.editor.graph).toBe(staged.editor.graph);
  expect(relaxed.mixedPortProtection).toBe(false);
});

test('visible socket reasons use native descriptions and remain semantic in minimal mode', async () => {
  const { Effect, Schema } = await import('effect');
  const { renderToString } = await import('foldkit/experimental/server');
  const { flowView } = await import('@opsydyn/foldkit-flow/foldkit');
  const { orbitNode, reasonSocketPort } = await import('../src/editor/presentation');
  const { Message } = await import('../src/editor/message');
  const state = createEditor(createProtectedWorkflowGraph());
  const policy = workbenchPolicy({ ...init().model, editor: state, mixedPortProtection: true });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<WorkbenchMessage>) => ({
          title: 'Protected',
          body: flowView(h, model, {
            id: 'protected',
            label: 'Protected workflow',
            onEvent: (message) => Message.ObservedFlowInput({ message }),
            renderNodeShell: orbitNode,
            renderPort: reasonSocketPort,
            canConnectPort: policy.canConnectPort,
            minimalMode: true,
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(result.html.match(/data-socket-reason/g)).toHaveLength(140);
  const id = 'protected-help-socket-' + encodeURIComponent(JSON.stringify(['load-1-2', 'in']));
  expect(result.html).toContain(`aria-describedby="${id}"`);
  expect(result.html).toContain(`id="${id}"`);
  expect(result.html).toContain('Approval required for this input.');
  expect(result.html).toContain('Output reserved for automation.');
});
