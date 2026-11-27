import { Component, Mount, type View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Effect, Schema, Stream } from 'effect';

import type { ZlozEdgeLabelContext, ZlozEdgeLabelEditorContext } from './edge-label';
import type { ZlozEdgeReconnectionOptions } from './edge-reconnection';
import { resolveEdgeToolbar } from './edge-toolbar-context';
import { edgeToolbarBand, edgeToolbarPosition } from './edge-toolbar-placement';
import { edgeToolbarContent } from './effect-ui-edge-toolbar';
import type { EditorEvent, EditorPolicy, EditorState, Point, ZlozEdge } from './types';

type EdgeEditEvent = Extract<
  EditorEvent,
  {
    type:
      | 'EdgeLabelEditingStarted'
      | 'EdgeLabelDraftChanged'
      | 'EdgeLabelSaved'
      | 'EdgeLabelCancelled'
      | 'EdgePathStyleChanged'
      | 'EdgeDeleted';
  }
>;

export type NativeEdgeEditing<M> = Readonly<{
  onEdit: (event: EdgeEditEvent) => M;
  toolbar?: boolean;
  toolbarDesign?: 'standard' | 'compact';
  pathLabel?: string;
  labelDesign?: EdgeLabelDesign | undefined;
  reconnection?: ZlozEdgeReconnectionOptions &
    Readonly<{
      onEvent: (event: Extract<EditorEvent, { type: 'EdgeReconnected' }>) => M;
    }>;
  renderLabel?: (context: ZlozEdgeLabelContext, h: Html.H<M>) => View.Content<M> | null | undefined;
  renderLabelEditor?: (
    context: ZlozEdgeLabelEditorContext,
    h: Html.H<M>,
  ) => View.Content<M> | null | undefined;
}>;

const edgeLabelFocus = Mount.make(
  'ZlozEdgeLabelFocus',
  { args: { editing: Schema.Boolean } },
  (element: HTMLElement, _, changes) =>
    Effect.suspend(() => {
      let wasEditing = false;
      return Stream.runForEach(changes, ({ editing }) =>
        Effect.sync(() => {
          const active = element.ownerDocument.activeElement;
          if (editing && !wasEditing)
            element.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
          if (
            !editing &&
            wasEditing &&
            (active === element.ownerDocument.body || element.contains(active))
          )
            element.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
          wasEditing = editing;
        }),
      ).pipe(Effect.map(() => Component.noop));
    }),
);

export function edgeLabel<M>(
  h: Html.H<M>,
  context: ZlozEdgeLabelContext,
  state: Pick<EditorState, 'edgeLabelDraft' | 'surface' | 'viewport'>,
  options: NativeEdgeEditing<M>,
  fallback: View.Content<M> | null,
) {
  const { edge, labelPosition, selected, readOnly, selectionDisabledReason } = context;
  const { id, label } = edge;
  const draft = state.edgeLabelDraft?.id === id ? state.edgeLabelDraft.text : undefined;
  const editable = !readOnly && selectionDisabledReason === undefined;
  const editing = editable && draft !== undefined;
  const { onEdit } = options;
  const custom = editing
    ? options.renderLabelEditor?.({ ...context, draft }, h)
    : options.renderLabel?.(context, h);
  if (!editing && (custom === null || (!label && !(selected && editable) && !custom && !fallback)))
    return undefined;
  const content =
    custom ??
    (editing ? null : fallback) ??
    edgeLabelControl(h, context, draft, onEdit, options.labelDesign);
  const { viewport, surface } = state;
  const width = Math.max(0, Math.min(276, (surface?.width ?? 292) - 16));
  const frame =
    editing && surface
      ? {
          left: `${clampLabelCenter(labelPosition.x, viewport.x, viewport.zoom, surface.width, width / 2 + 8)}px`,
          top: `${clampLabelCenter(labelPosition.y, viewport.y, viewport.zoom, surface.height, 56)}px`,
          width: `${width}px`,
          transform: `translate(-50%, -50%) scale(${1 / viewport.zoom})`,
        }
      : { left: `${labelPosition.x}px`, top: `${labelPosition.y}px` };
  return h.div
    .key(`label:${id}`)
    .class('zloz-ui-edge-label-frame')
    .attr('data-flow-no-drag', '')
    .attr('data-zloz-edge-label', id)
    .style({
      ...frame,
      pointerEvents: editable ? 'auto' : 'none',
    })
    .onMount(edgeLabelFocus({ editing }))
    .children(content);
}

export type EdgeLabelDesign = Readonly<{
  badgeClass?: string;
  editorClass?: string;
  icon?: string;
  saveLabel?: string;
  cancelLabel?: string;
}>;

/** Reuse the native label control when its geometry is owned by a containing canvas. */
export function edgeLabelControls<M>(
  h: Html.H<M>,
  context: ZlozEdgeLabelContext,
  draft: string | undefined,
  onEdit: (event: EdgeEditEvent) => M,
  design: EdgeLabelDesign,
) {
  const editing =
    !context.readOnly && context.selectionDisabledReason === undefined && draft !== undefined;
  return h.div
    .attr('data-flow-edge-label-control', context.edge.id)
    .onMount(edgeLabelFocus({ editing }))
    .children(edgeLabelControl(h, context, draft, onEdit, design));
}

function edgeLabelControl<M>(
  h: Html.H<M>,
  context: ZlozEdgeLabelContext,
  draft: string | undefined,
  onEdit: (event: EdgeEditEvent) => M,
  design: EdgeLabelDesign = {},
) {
  const {
    edge: { id, label },
    description,
    readOnly,
    selectionDisabledReason,
  } = context;
  const editable = !readOnly && selectionDisabledReason === undefined;
  const labelContent = label || 'Add label';
  const icon = design.icon ? h.span.attr('aria-hidden', 'true').children(design.icon) : null;
  if (!editable)
    return h.span
      .class('zloz-ui-edge-label-badge', design.badgeClass)
      .attr('title', selectionDisabledReason)
      .children(icon, label ?? '');
  if (draft === undefined)
    return h.button
      .class('zloz-ui-edge-label-badge', design.badgeClass)
      .attr('type', 'button')
      .attr(
        'aria-label',
        label ? `Edit edge label ${label} for ${description}` : `Add label for ${description}`,
      )
      .attr('data-flow-context-edge', id)
      .attr('data-selected', design.badgeClass ? String(context.selected) : undefined)
      .on('click', onEdit({ type: 'EdgeLabelEditingStarted', id }))
      .children(icon, design.badgeClass ? h.span.children(labelContent) : labelContent);
  return h.form
    .class('zloz-ui-edge-label-editor', design.editorClass)
    .on('submit', onEdit({ type: 'EdgeLabelSaved', id }))
    .on(
      'keydown',
      ({ key }) => (key === 'Escape' ? onEdit({ type: 'EdgeLabelCancelled', id }) : undefined),
      { preventDefault: true },
    )
    .children(
      h.input
        .attr('type', 'text')
        .attr('aria-label', `Edge label for ${description}`)
        .value(draft)
        .on('input', ({ value: text }) => onEdit({ type: 'EdgeLabelDraftChanged', id, text })),
      h.button.attr('type', 'submit').children(design.saveLabel ?? 'Save label'),
      h.button
        .attr('type', 'button')
        .on('click', onEdit({ type: 'EdgeLabelCancelled', id }))
        .children(design.cancelLabel ?? 'Cancel'),
    );
}

function clampLabelCenter(
  world: number,
  origin: number,
  zoom: number,
  extent: number,
  padding: number,
) {
  const inset = Math.min(padding, extent / 2);
  const screen = Math.min(extent - inset, Math.max(inset, origin + world * zoom));
  return (screen - origin) / zoom;
}

export function edgeToolbar<M>(
  h: Html.H<M>,
  id: string,
  state: EditorState,
  edge: ZlozEdge,
  position: Point,
  handlePoints: readonly Point[],
  policy: EditorPolicy | undefined,
  { onEdit, reconnection, toolbarDesign, pathLabel }: NativeEdgeEditing<M>,
) {
  const frameId = `${encodeURIComponent(id)}-edge-actions`;
  const context = resolveEdgeToolbar(
    state,
    edge,
    position,
    policy,
    reconnection ? { idPrefix: `${frameId}-endpoint`, options: reconnection } : undefined,
  );
  const height = state.surface?.height ?? 420;
  const { x, y } = edgeToolbarPosition(position, state.viewport, handlePoints, height);
  const band = context.reconnection
    ? edgeToolbarBand(
        height,
        handlePoints.map((point) => state.viewport.y + point.y * state.viewport.zoom),
        9 * state.viewport.zoom + 6,
      )
    : undefined;
  const width = band ? 320 : 300;
  return h.div
    .key(`toolbar:${edge.id}`)
    .id(frameId)
    .class('zloz-ui-edge-toolbar-frame')
    .attr('role', 'group')
    .attr('aria-label', 'Selected edge actions')
    .attr('data-flow-no-drag', '')
    .attr('data-flow-edge-toolbar', '')
    .attr('tabindex', '-1')
    .style({
      left: `clamp(6px, ${x - width / 2}px, max(6px, calc(100% - ${width + 6}px)))`,
      top: band ? `${band.top}px` : `clamp(6px, ${y}px, max(6px, calc(100% - 82px)))`,
      maxHeight: band ? `${band.height}px` : 'calc(100% - 12px)',
      overflow: band ? 'auto' : 'visible',
      width: `min(${width}px, calc(100% - 12px))`,
    })
    .children(
      edgeToolbarContent(h, context, {
        pathLabel: pathLabel ?? 'Path style',
        design: toolbarDesign,
        onEvent: (event) => {
          if (event.type === 'EdgeReconnected') return reconnection?.onEvent(event);
          return event.type === 'EdgeLabelEditingStarted' ||
            event.type === 'EdgePathStyleChanged' ||
            event.type === 'EdgeDeleted'
            ? onEdit(event)
            : undefined;
        },
      }),
    );
}
