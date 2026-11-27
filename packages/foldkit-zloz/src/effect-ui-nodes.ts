import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import {
  notationDescription,
  notationView,
  notationDash,
  notationPrefix,
  notationStroke,
  type NativeNotationLabels,
  type NativeNotationParts,
} from './effect-ui-notation';
import { portSockets, type GraphPortOptions } from './effect-ui-ports';
import { nodeResizeControls } from './effect-ui-resize';
import { groupHeaderPosition, resolveLayoutGroupHeader } from './group-header';
import { withDescendants } from './group-presentation';
import { movementReason } from './movement';
// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Reuse the canonical authored outline.
import { nodeShapeGeometry } from './node-shape';
import type { EditorState, LayoutGroupHeader, LayoutGroupHeaderSpec, ZlozNode } from './types';

export type NativeNodeShellContext = Readonly<{
  node: ZlozNode;
  selected: boolean;
  collapsed: boolean;
  dropTarget: boolean;
  selectionPreview: boolean;
  readOnly: boolean;
  moveDisabledReason: string | undefined;
  selectionDisabledReason: string | undefined;
}>;

export type NativeNodeShell<M> = Readonly<{
  className?: string;
  /** App-owned data attributes for styling and inspection. Interaction attributes remain SDK-owned. */
  dataAttributes?: Readonly<Record<`data-${string}`, string | undefined>>;
  style?: Html.Style;
  /** Set false to replace the built-in outline with custom artwork. */
  outline?: boolean;
  /** Set false to hide collapse, context and resize controls. Ports remain available. */
  controls?: boolean;
  title?: Readonly<{
    className?: string;
    style?: Html.Style;
    description?: string;
    content?: string | View.Content<M>;
  }>;
  body?: string | View.Content<M>;
}>;

type NodeShellRenderer<M> = (
  context: NativeNodeShellContext,
  h: Html.H<M>,
) => NativeNodeShell<M> | undefined;

/** Declared heading envelope or an intrinsic heading measured before layout. */
export type NativeGroupHeader =
  | (LayoutGroupHeader & Readonly<{ sizing?: 'declared' }>)
  | (LayoutGroupHeaderSpec & Readonly<{ sizing: 'intrinsic' }>);

export type NativeNodeOptions<M> = GraphPortOptions<M> &
  Readonly<{
    descriptionId?: string;
    /** Expose native width controls and eight-direction controls for expanded selected groups. */
    resizeHandles?: boolean;
    nodeNote?: (node: ZlozNode) => string;
    architectureNotation?: boolean;
    notationLabels?: NativeNotationLabels;
    notationParts?: NativeNotationParts<M>;
    groupHeader?: (node: ZlozNode) => NativeGroupHeader | undefined;
    onToggleGroup?: (id: string) => M;
    nodeContextAction?: (node: ZlozNode) => M;
    /** Change presentation while retaining the keyed frame and the native controller buttons. */
    renderNodeShell?: NodeShellRenderer<M>;
    renderGroupShell?: NodeShellRenderer<M>;
  }>;

export function nodeView<Message>(
  h: Html.H<Message>,
  editor: EditorState,
  options: NativeNodeOptions<Message>,
  node: ZlozNode,
  selecting: boolean,
  surfaceId: string,
) {
  const note = options.nodeNote?.(node);
  const selected = editor.selectedNodes.includes(node.id);
  const architecture = options.architectureNotation ? node.architecture : undefined;
  const prefix = architecture && notationPrefix(architecture);
  const notation = architecture
    ? h.lazy(
        notationView<Message>,
        JSON.stringify([surfaceId, 'notation', node.id]),
        node,
        architecture,
        selected,
        selecting,
        options.notationLabels,
        options.notationParts,
      )
    : null;
  const meaning = architecture
    ? options.notationParts?.describeMeaning?.({
        node,
        architecture,
        selected,
        selectionPreview: selecting,
      })
    : undefined;
  const description =
    meaning === undefined && architecture
      ? notationDescription(node, architecture, options.notationLabels)
      : (meaning ?? undefined);
  const accent = notationStroke(architecture);
  const group = node.kind === 'group';
  const collapsed = group && editor.collapsedGroups.includes(node.id);
  const toggle = group ? options.onToggleGroup : undefined;
  const dropTarget = editor.gesture.type === 'node-drag' && editor.gesture.dropParent === node.id;
  const selectionDisabledReason = options.policy?.canSelectNode?.(node, editor.graph) ?? undefined;
  const canMoveNode = options.policy?.canMoveNode;
  const moveDisabledReason =
    group && canMoveNode
      ? (movementReason(editor.graph, withDescendants(editor.graph, [node.id]), canMoveNode) ??
        undefined)
      : (canMoveNode?.(node, editor.graph) ?? undefined);
  const shell = (group ? options.renderGroupShell : options.renderNodeShell)?.(
    {
      node,
      selected,
      collapsed,
      dropTarget,
      selectionPreview: selecting,
      readOnly: editor.readOnly,
      moveDisabledReason,
      selectionDisabledReason,
    },
    h,
  );

  const header = group ? resolveHeader(node, collapsed, options.groupHeader?.(node)) : undefined;
  const controls = shell?.controls !== false;
  const hasOutline = architecture ? !group : node.appearance !== undefined;
  // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Use the authored outline geometry.
  const outline = hasOutline ? nodeShapeGeometry(node) : null;
  const content = outline?.contentBounds;
  const svg = (tag: 'svg' | 'path') => new Html.Element<Message>(tag);
  const dataAttributes = Object.fromEntries(
    Object.entries(shell?.dataAttributes ?? {}).filter(
      ([name]) => name.startsWith('data-') && !name.startsWith('data-flow-'),
    ),
  );
  return (
    h.div
      .attrs(dataAttributes)
      .key(node.id)
      .class('zloz-ui-node', shell?.className)
      .attr('data-flow-node', node.id)
      .attr('data-flow-x', String(node.position.x))
      .attr('data-flow-y', String(node.position.y))
      .attr('data-flow-group', group ? node.id : undefined)
      .attr('data-flow-group-drop-target', dropTarget ? '' : undefined)
      .attr('data-node-kind', node.kind)
      .attr('data-flow-group-collapsed', group ? String(collapsed) : undefined)
      .attr('data-notation', architecture?.family)
      .attr(prefix ? `data-${prefix}-${group ? 'group' : 'node'}` : 'data-node-id', node.id)
      // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- Read the canonical authored geometry.
      .attr('data-node-outline', outline?.shape)
      .attr('data-selection-preview', selecting ? 'true' : undefined)
      .attr('data-flow-selection-preview', selecting ? 'true' : undefined)
      .style({
        ...shell?.style,
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        '--zloz-ui-notation-accent': accent,
      })
      .children(
        outline && shell?.outline !== false
          ? svg('svg')
              .class('zloz-ui-node-outline')
              .attr('aria-hidden', 'true')
              .attr('viewBox', `0 0 ${node.size.width} ${node.size.height}`)
              .children(
                svg('path')
                  .attr('d', outline.outlinePath)
                  .attr('stroke-dasharray', notationDash(architecture, selecting))
                  .attr('vector-effect', 'non-scaling-stroke')
                  .attr(prefix ? `data-${prefix}-outline` : 'data-outline', ''),
                ...outline.decorationPaths.map((path) =>
                  svg('path')
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr(prefix ? `data-${prefix}-cap` : 'data-outline-decoration', ''),
                ),
              )
          : null,
        h.lazy(
          nodeTitle,
          JSON.stringify([surfaceId, 'title', node.id]),
          node.id,
          node.label,
          selected,
          selectionDisabledReason,
          moveDisabledReason,
          shell?.title?.className,
          shell?.title?.description ?? description,
          header ? node.id : undefined,
          header ? { ...shell?.title?.style, ...header } : shell?.title?.style,
          architecture && content ? `${content.y}px auto auto ${content.x}px` : undefined,
          architecture && content ? `${content.width}px` : undefined,
          architecture && content ? `${content.height}px` : undefined,
          shell?.title?.content ?? notation ?? node.label,
        ),
        controls && toggle && !editor.readOnly
          ? h.button
              .key('collapse-toggle')
              .class('zloz-ui-collapse-toggle')
              .attr('type', 'button')
              .attr('data-flow-no-drag', '')
              .attr('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${node.label}`)
              .attr('aria-expanded', String(!collapsed))
              .disabled(editor.gesture.type !== 'idle')
              .on('click', toggle(node.id))
              .children(collapsed ? 'Expand' : 'Collapse')
          : null,
        controls &&
          options.nodeContextAction &&
          !editor.readOnly &&
          selectionDisabledReason === undefined
          ? h.button
              .key('more-actions')
              .class('zloz-ui-node-context')
              .attr('type', 'button')
              .attr('data-flow-no-drag', '')
              .attr('data-flow-context-node', node.id)
              .attr('aria-label', `More actions for ${node.label}`)
              .attr(
                'aria-expanded',
                String(editor.context?.kind === 'node' && editor.context.id === node.id),
              )
              .disabled(editor.gesture.type !== 'idle')
              .on('click', options.nodeContextAction(node))
              .children('⋯')
          : null,
        shell?.body,
        ...(note ? [h.p.class('zloz-ui-node-note').children(note)] : []),
        ...(controls && options.resizeHandles
          ? nodeResizeControls(h, node, editor, options.policy, surfaceId, options.descriptionId)
          : []),
        ...portSockets(h, editor, node, options, surfaceId),
      )
  );
}

function resolveHeader(
  node: ZlozNode,
  collapsed: boolean,
  spec: NativeGroupHeader | undefined,
): Html.Style | undefined {
  if (!spec || collapsed) return undefined;
  const declared = spec.sizing === 'intrinsic' ? undefined : resolveLayoutGroupHeader(node, spec);
  const position = declared?.position ?? groupHeaderPosition(node, spec);
  return {
    position: 'absolute',
    top: `${position.y - node.position.y}px`,
    left: `${position.x - node.position.x}px`,
    width: declared ? `${declared.size.width}px` : 'max-content',
    height: declared ? `${declared.size.height}px` : 'max-content',
    overflow: 'hidden',
  };
}

function nodeTitle<M>(
  h: Html.H<M>,
  _cacheKey: string,
  id: string,
  label: string,
  selected: boolean,
  selectionDisabledReason: string | undefined,
  moveDisabledReason: string | undefined,
  className: string | undefined,
  description: string | undefined,
  headerId: string | undefined,
  style: Html.Style | undefined,
  inset: string | undefined,
  width: string | undefined,
  height: string | undefined,
  content: string | View.Content<M>,
) {
  return h.button
    .key('title')
    .class('zloz-ui-node-title', className)
    .attr('type', 'button')
    .attr('data-flow-handle', id)
    .attr('data-zloz-group-header', headerId)
    .attr('aria-label', `Select ${label}`)
    .attr('aria-description', description)
    .attr('title', selectionDisabledReason ?? moveDisabledReason)
    .attr('data-flow-move-locked', moveDisabledReason === undefined ? undefined : '')
    .disabled(selectionDisabledReason !== undefined)
    .attr('aria-pressed', String(selected))
    .style({
      inset,
      width,
      height,
      ...style,
      cursor: moveDisabledReason === undefined ? style?.cursor : 'pointer',
    })
    .children(content);
}
