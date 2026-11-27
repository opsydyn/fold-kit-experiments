import { Component, Mount, type View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Effect, Schema, Stream } from 'effect';

import { resolveDeletion } from './deletion';
import type { ZlozEdgeLabelContext, ZlozEdgeLabelEditorContext } from './edge-label';
import { edgePathStyles, edgeToolbarPosition } from './edge-toolbar-placement';
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
  const { edge, labelPosition, description, selected, readOnly, selectionDisabledReason } = context;
  const { id, label } = edge;
  const draft = state.edgeLabelDraft?.id === id ? state.edgeLabelDraft.text : undefined;
  const editable = !readOnly && selectionDisabledReason === undefined;
  const editing = editable && draft !== undefined;
  const { onEdit } = options;
  const custom = editing
    ? options.renderLabelEditor?.({ ...context, draft }, h)
    : options.renderLabel?.(context, h);
  if (!editing && custom === undefined && fallback) return fallback;
  if (!editing && (custom === null || (!label && !(selected && editable) && !custom)))
    return undefined;
  const badge = () =>
    editable
      ? h.button
          .class('zloz-ui-edge-label-badge')
          .attr('type', 'button')
          .attr(
            'aria-label',
            label ? `Edit edge label ${label} for ${description}` : `Add label for ${description}`,
          )
          .attr('data-flow-context-edge', id)
          .on('click', onEdit({ type: 'EdgeLabelEditingStarted', id }))
          .children(label || 'Add label')
      : h.span
          .class('zloz-ui-edge-label-badge')
          .attr('title', selectionDisabledReason)
          .children(label);
  const editor = () =>
    h.form
      .class('zloz-ui-edge-label-editor')
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
          .value(draft ?? '')
          .on('input', ({ value: text }) => onEdit({ type: 'EdgeLabelDraftChanged', id, text })),
        h.button.attr('type', 'submit').children('Save label'),
        h.button
          .attr('type', 'button')
          .on('click', onEdit({ type: 'EdgeLabelCancelled', id }))
          .children('Cancel'),
      );
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
    .children(custom ?? (editing ? editor() : badge()));
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
  state: EditorState,
  edge: ZlozEdge,
  position: Point,
  handlePoints: readonly Point[],
  policy: EditorPolicy | undefined,
  onEdit: NativeEdgeEditing<M>['onEdit'],
) {
  const { id } = edge;
  const decision = resolveDeletion(state.graph, { nodeIds: [], edgeIds: [id] }, policy?.canDelete);
  const reason = decision.type === 'blocked' ? decision.reason : undefined;
  const { x, y } = edgeToolbarPosition(
    position,
    state.viewport,
    handlePoints,
    state.surface?.height ?? 420,
  );
  return h.div
    .key(`toolbar:${id}`)
    .class('zloz-ui-edge-toolbar')
    .attr('role', 'group')
    .attr('aria-label', 'Selected edge actions')
    .attr('data-flow-no-drag', '')
    .style({ left: `clamp(min(50%, 160px), ${x}px, max(50%, calc(100% - 160px)))`, top: `${y}px` })
    .children(
      h.button
        .attr('type', 'button')
        .on('click', onEdit({ type: 'EdgeLabelEditingStarted', id }))
        .children('Rename'),
      h.select
        .attr('aria-label', 'Path style')
        .on('change', ({ value }) =>
          onEdit({
            type: 'EdgePathStyleChanged',
            id,
            pathStyle: edgePathStyles.find(({ style }) => style === value)?.style ?? null,
          }),
        )
        .children(
          ...edgePathStyles.map(({ label, style }) =>
            h.option
              .attr('value', style ?? '')
              .selected((edge.pathStyle ?? null) === style)
              .children(label),
          ),
        ),
      h.button
        .attr('type', 'button')
        .attr('title', reason)
        .disabled(reason !== undefined)
        .on('click', onEdit({ type: 'EdgeDeleted', id }))
        .children('Delete edge'),
      reason === undefined ? null : h.small.children(reason),
    );
}
