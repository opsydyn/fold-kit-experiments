import { fittedGroupBounds } from './geometry';
import {
  copyGroupSelectionV3,
  planGroupPasteV3,
  type ZlozGroupClipboardPolicyV3,
} from './group-clipboard-v3';
import { planGroupConnectionV3 } from './group-connection-v3';
import { captureGroupEditorSourceV3, type ZlozGroupEditorPolicyV3 } from './group-editor-v3';
import { planGroupOperationV3 } from './group-operations-v3';
import { planGroupPortEditV3 } from './group-port-edit-v3';
import {
  groupWorkbenchPasteRequestV3,
  type ZlozGroupWorkbenchEventV3,
  type ZlozGroupWorkbenchV3,
} from './group-workbench-v3';
import type { EdgeEnd, Point } from './types';

export type GroupActionV3 = Readonly<{
  type: 'action';
  label: string;
  event: ZlozGroupWorkbenchEventV3;
  reason: string | null;
}>;
type GroupInspectorEntryV3 =
  | GroupActionV3
  | Readonly<{ type: 'text'; label: string }>
  | Readonly<{ type: 'port'; id: string; label: string; actions: readonly GroupActionV3[] }>
  | Readonly<{ type: 'reconnect'; end: EdgeEnd; actions: readonly GroupActionV3[] }>;

const finishGesture = 'Finish or cancel the active gesture first.';

export function groupClipboardActionsV3(
  model: ZlozGroupWorkbenchV3,
  policy: ZlozGroupClipboardPolicyV3,
  offset: Point,
): readonly GroupActionV3[] {
  const copy = copyGroupSelectionV3(model.editor, model.selectedNodeIds, policy);
  const request = groupWorkbenchPasteRequestV3(model, offset);
  const paste = request ? planGroupPasteV3(model.editor, request, policy) : null;
  const busy = model.gesture.type === 'idle' ? null : finishGesture;
  return [
    {
      type: 'action',
      label: 'Copy selection',
      event: { type: 'CopyPressed' },
      reason: busy ?? (copy.type === 'blocked' ? copy.reason : null),
    },
    {
      type: 'action',
      label: 'Paste copy',
      event: request ? { type: 'GroupPasteRequested', request } : { type: 'PastePressed' },
      reason:
        busy ??
        (paste?.type === 'blocked'
          ? paste.reason
          : request
            ? null
            : 'Copy a selection before pasting.'),
    },
  ];
}

/** Shared view proposals. Apply still checks the current native document and policy. */
export function groupInspectorEntriesV3(
  model: ZlozGroupWorkbenchV3,
  policy: ZlozGroupEditorPolicyV3,
): readonly GroupInspectorEntryV3[] {
  const source = captureGroupEditorSourceV3(model.editor);
  const action = (label: string, event: ZlozGroupWorkbenchEventV3): GroupActionV3 => {
    const plan =
      event.type === 'GroupOperationRequested'
        ? planGroupOperationV3(model.editor, { source, operation: event.operation }, policy)
        : event.type === 'GroupPortEditRequested'
          ? planGroupPortEditV3(model.editor, { source, edit: event.edit }, policy)
          : event.type === 'ConnectionEditRequested'
            ? planGroupConnectionV3(model.editor, { source, edit: event.edit }, policy)
            : null;
    const reason =
      model.gesture.type !== 'idle' ? finishGesture : plan?.type === 'blocked' ? plan.reason : null;
    return { type: 'action', label, event, reason };
  };
  const text = (label: string): GroupInspectorEntryV3 => ({ type: 'text', label });
  const operation = (
    label: string,
    value: Extract<ZlozGroupWorkbenchEventV3, { type: 'GroupOperationRequested' }>['operation'],
  ) => action(label, { type: 'GroupOperationRequested', operation: value });
  const { nodes, edges } = model.editor.document.graph;
  const selected = new Set(model.selectedNodeIds);
  const node = selected.size === 1 ? nodes.find(({ id }) => selected.has(id)) : undefined;
  const edge = edges.find(({ id }) => id === model.selectedEdgeId);
  const selectedNodes = nodes.filter(({ id }) => selected.has(id));
  const bounds = selectedNodes.length ? fittedGroupBounds(selectedNodes) : null;
  return [
    ...(bounds
      ? [
          operation('Group selected nodes', {
            operation: 'group',
            nodeIds: model.selectedNodeIds,
            node: {
              id: `${model.editor.sessionId}:group:${model.editor.revision + 1}`,
              label: 'New group',
              kind: 'group',
              ...bounds,
              ports: [],
            },
          }),
          ...nodes
            .filter((parent) => parent.kind === 'group' && !selected.has(parent.id))
            .map((parent) =>
              operation(`Move into ${parent.label}`, {
                operation: 'reparent',
                nodeIds: model.selectedNodeIds,
                parentId: parent.id,
              }),
            ),
        ]
      : []),
    ...(selected.size
      ? [
          text(node?.label ?? `${selected.size} selected nodes`),
          ...[
            { x: -20, y: 0, label: 'Move left' },
            { x: 20, y: 0, label: 'Move right' },
            { x: 0, y: -20, label: 'Move up' },
            { x: 0, y: 20, label: 'Move down' },
          ].map(({ x, y, label }) =>
            operation(label, {
              operation: 'move',
              nodeIds: model.selectedNodeIds,
              delta: { x, y },
            }),
          ),
          operation('Detach from parent', {
            operation: 'reparent',
            nodeIds: model.selectedNodeIds,
            parentId: null,
          }),
          operation('Delete selected nodes', {
            operation: 'delete',
            nodeIds: model.selectedNodeIds,
            edgeIds: [],
          }),
        ]
      : [text('Select a node or connection to inspect it.')]),
    ...(node
      ? [
          operation('Wider', {
            operation: 'resize',
            id: node.id,
            size: { ...node.size, width: node.size.width + 20 },
          }),
          operation('Narrower', {
            operation: 'resize',
            id: node.id,
            size: { ...node.size, width: Math.max(1, node.size.width - 20) },
          }),
          operation('Taller', {
            operation: 'resize',
            id: node.id,
            size: { ...node.size, height: node.size.height + 20 },
          }),
          operation('Shorter', {
            operation: 'resize',
            id: node.id,
            size: { ...node.size, height: Math.max(1, node.size.height - 20) },
          }),
        ]
      : []),
    ...(node?.kind === 'group'
      ? [
          action(model.collapsedGroupIds.includes(node.id) ? 'Expand group' : 'Collapse group', {
            type: 'GroupCollapseToggled',
            id: node.id,
          }),
          operation('Ungroup', { operation: 'ungroup', id: node.id }),
          action('Add output port', {
            type: 'GroupPortEditRequested',
            edit: {
              operation: 'add',
              nodeId: node.id,
              port: {
                id: `${node.id}:port:${model.editor.revision + 1}`,
                kind: 'output',
                side: 'right',
                offset: 0.5,
              },
            },
          }),
          ...node.ports.map((port): GroupInspectorEntryV3 => {
            const endpoint = { node: node.id, port: port.id };
            return {
              type: 'port',
              id: port.id,
              label: `${port.label ?? port.id} (${port.kind})`,
              actions: [
                action('Anchor at top', {
                  type: 'GroupPortEditRequested',
                  edit: { operation: 'position', endpoint, position: { side: 'top', offset: 0.5 } },
                }),
                action('Anchor at right', {
                  type: 'GroupPortEditRequested',
                  edit: {
                    operation: 'position',
                    endpoint,
                    position: { side: 'right', offset: 0.5 },
                  },
                }),
                action('Remove port and attached connections', {
                  type: 'GroupPortEditRequested',
                  edit: { operation: 'remove', endpoint },
                }),
              ],
            };
          }),
        ]
      : []),
    ...(edge
      ? [
          text(edge.label ?? edge.id),
          operation('Delete connection', { operation: 'delete', nodeIds: [], edgeIds: [edge.id] }),
          ...(['source', 'target'] as const).map(
            (end): GroupInspectorEntryV3 => ({
              type: 'reconnect',
              end,
              actions: nodes.flatMap((node) =>
                node.ports.map((port) =>
                  action(`${node.label}: ${port.label ?? port.id}`, {
                    type: 'ConnectionEditRequested',
                    edit: {
                      operation: 'reconnect',
                      edgeId: edge.id,
                      end,
                      endpoint: { node: node.id, port: port.id },
                    },
                  }),
                ),
              ),
            }),
          ),
        ]
      : []),
  ];
}
