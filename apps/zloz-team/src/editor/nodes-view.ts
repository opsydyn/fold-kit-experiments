import type { EditorState, ZlozNode } from '@opsydyn/foldkit-zloz';
import {
  zlozDragHandle,
  zlozResizeHandle,
  type ZlozNodeRenderContext,
} from '@opsydyn/foldkit-zloz/foldkit';
import { createLazy, type Html, type HtmlBuilder } from 'foldkit/html';

import { c4Appearance } from '../appearance/c4';
import { sharedNodeFrame } from './node-frame';
import { nodeIcon } from './team-icons';

/** One weak slot per immutable node; native ports and policies resolve before lookup. */
export function createNodesView<Message>(onIconFailure?: (icon: string) => Message) {
  const slots = new WeakMap<ZlozNode, ReturnType<typeof createLazy>>();
  const body = (
    h: HtmlBuilder<Message>,
    node: ZlozNode,
    team: string,
    iconFailed: boolean,
    selectedNodes: EditorState['selectedNodes'],
    readOnly: boolean,
    descriptionId: string,
    selectionPreview: boolean,
    collapsed: boolean,
    dropTarget: boolean,
    moveDisabledReason: string | undefined,
    resizeDisabledReason: string | undefined,
    selectionDisabledReason: string | undefined,
    measurements: boolean,
    alignmentGuides: boolean,
    zoomLevel: boolean,
    status: boolean,
    instructions: boolean,
    overview: boolean,
    connectionList: boolean,
    ...ports: readonly Html[]
  ) => {
    // The public handle primitives read this narrow state, not an invented graph
    // or a retained EditorState. Keep the entire current selection available.
    const context = {
      node,
      state: { selectedNodes, readOnly },
      descriptionId,
      selectionPreview,
      collapsed,
      dropTarget,
      moveDisabledReason,
      resizeDisabledReason,
      selectionDisabledReason,
      diagnostics: {
        measurements,
        alignmentGuides,
        zoomLevel,
        status,
        instructions,
        overview,
        connectionList,
      },
    };
    const architecture = node.architecture;
    const family = architecture?.family ?? 'untyped';
    const c4 = architecture?.family === 'c4' ? c4Appearance(architecture) : null;
    const icon = c4?.icon ?? 'cube';
    const type =
      c4?.label ??
      (architecture
        ? `${architecture.family === 'ddd' ? 'DDD' : 'Event storming'} · ${architecture.role.replaceAll('-', ' ')}`
        : null);
    return sharedNodeFrame(
      h,
      context,
      [
        h.Class(selectedNodes.includes(node.id) ? 'shared-node is-selected' : 'shared-node'),
        h.DataAttribute('architecture', family),
        h.Style({ height: `${node.size.height}px` }),
      ],
      [
        zlozDragHandle(
          h,
          context,
          [h.Class('shared-node-title')],
          [
            h.span(
              [h.Class('node-name')],
              [
                nodeIcon(h, team, iconFailed ? undefined : node.icon, icon, onIconFailure),
                h.span([], [node.label]),
              ],
            ),
            ...(type ? [h.span([h.Class('node-type')], [type])] : []),
          ],
        ),
        ...(readOnly || selectionDisabledReason !== undefined || resizeDisabledReason !== undefined
          ? []
          : [zlozResizeHandle(h, context, 'right', [h.Class('shared-node-resize')], ['↔'])]),
        ...ports,
      ],
    );
  };
  return (
    context: ZlozNodeRenderContext,
    h: HtmlBuilder<Message>,
    team = '',
    iconFailed = false,
  ) => {
    const slot = slots.get(context.node) ?? createLazy();
    slots.set(context.node, slot);
    const flags = context.diagnostics;
    return slot(body, [
      h,
      context.node,
      team,
      iconFailed,
      context.state.selectedNodes,
      context.state.readOnly,
      context.descriptionId,
      context.selectionPreview,
      context.collapsed,
      context.dropTarget,
      context.moveDisabledReason,
      context.resizeDisabledReason,
      context.selectionDisabledReason,
      flags.measurements,
      flags.alignmentGuides,
      flags.zoomLevel,
      flags.status,
      flags.instructions,
      flags.overview,
      flags.connectionList,
      ...(context.ports ?? []),
    ]);
  };
}
