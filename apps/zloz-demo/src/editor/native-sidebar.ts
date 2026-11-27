import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { EditorEvent } from '@opsydyn/foldkit-zloz';
import {
  toolbarControl,
  visuallyHidden,
  type ZlozCanvasHelpContext,
  type ZlozCanvasStatusContext,
  type ZlozConnectionsContext,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Effect, Schema, Stream } from 'effect';

import { Message } from './message';
import { architectureNativePanel } from './native-panel';

export const nativeCanvasHelp = architectureNativePanel<
  Readonly<{ id: string; context: ZlozCanvasHelpContext; card: boolean }>
>((h, { id, context, card }) => {
  const style = context.visible ? {} : visuallyHidden;
  if (!card)
    return h.p.attr('id', id).attr('data-flow-help', '').style(style).children(context.defaultText);
  return h.div
    .attr('id', id)
    .attr('data-flow-help', '')
    .style(style)
    .children(
      h.div
        .class('canvas-help-card')
        .style({
          background: 'light-dark(#eff6ff, #192c40)',
          color: 'light-dark(#1e3a8a, #c4d9ff)',
          padding: '10px 14px',
          margin: '8px 0',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          lineHeight: '1.45',
        })
        .children(
          h.strong.children('Canvas controls'),
          h.p.style({ margin: '4px 0 0' }).children(context.defaultText),
        ),
    );
});

export const nativeCanvasStatus = architectureNativePanel<
  Readonly<{ context: ZlozCanvasStatusContext; card: boolean }>
>((h, { context, card }) => {
  const summary = `${context.nodeCount} ${context.nodeCount === 1 ? 'node' : 'nodes'} · ${context.connectionCount} ${context.connectionCount === 1 ? 'connection' : 'connections'}`;
  return h.div
    .attr('data-flow-status', '')
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .style(context.visible ? { minHeight: '1.5em' } : visuallyHidden)
    .children(
      card
        ? h.span
            .class('canvas-status-card')
            .style({
              display: 'inline-block',
              color: 'light-dark(#0f4c3a, #b9efda)',
              background: 'light-dark(#d1fae5, #1f4537)',
              padding: '4px 10px',
              margin: '6px 0',
              borderRadius: '999px',
            })
            .children(context.notice ?? summary)
        : context.defaultText,
    );
});

const focusEdgeActions = Mount.makeStream(
  'ArchitectureConnectionListFocus',
  { args: {} },
  (list: HTMLElement) =>
    Stream.callback<never>(() => {
      const bind = Effect.sync(() => {
        const focusToolbar = (event: KeyboardEvent) => {
          if (event.key !== 'ArrowUp' || !(event.target instanceof HTMLButtonElement)) return;
          const toolbarId = event.target.getAttribute('aria-controls');
          if (!toolbarId) return;
          const toolbar = list.ownerDocument.getElementById(toolbarId);
          if (!toolbar) return;
          event.preventDefault();
          (toolbar.querySelector<HTMLElement>(toolbarControl) ?? toolbar).focus();
        };
        list.addEventListener('keydown', focusToolbar);
        return () => list.removeEventListener('keydown', focusToolbar);
      });
      return Effect.acquireRelease(bind, Effect.sync);
    }),
);

function connectionEntry<M>(
  h: Html.H<M>,
  entry: ZlozConnectionsContext['entries'][number],
  context: ZlozConnectionsContext,
  rows: boolean,
  onEvent: (event: EditorEvent) => M,
) {
  const endpoints = `${entry.sourceLabel} → ${entry.targetLabel}`;
  const label = rows ? (entry.edge.label ?? endpoints) : entry.label;
  const { contextAction, selectionDisabledReason, toolbarId } = entry;
  const select = h.button
    .key(entry.edge.id)
    .attr('type', 'button')
    .attr('aria-label', label)
    .attr('aria-pressed', String(entry.selected))
    .attr('aria-controls', toolbarId)
    .attr('aria-keyshortcuts', toolbarId ? 'ArrowUp' : undefined)
    .attr('title', selectionDisabledReason)
    .disabled(selectionDisabledReason !== undefined)
    .on('click', onEvent({ type: 'EdgeSelected', id: entry.edge.id, additive: false }));
  const selectionControl =
    contextAction && !contextAction.disabled
      ? select.on(
          'keydown',
          ({ key, shift }) =>
            key === 'ContextMenu' || (key === 'F10' && shift)
              ? onEvent(contextAction.event)
              : undefined,
          { preventDefault: true },
        )
      : select;
  const selection = rows
    ? selectionControl
        .style({
          flex: '1',
          minWidth: '0',
          display: 'grid',
          gap: '2px',
          minHeight: '38px',
          border: '0',
          padding: '4px 8px',
          textAlign: 'left',
          background: 'transparent',
          color: 'light-dark(#1e3a8a, #c4d9ff)',
          cursor: 'pointer',
        })
        .children(
          h.strong.children(label),
          !context.compact && entry.edge.label ? h.small.children(endpoints) : null,
        )
    : selectionControl.children(label);
  const actions = contextAction
    ? h.button
        .attr('type', 'button')
        .attr('aria-label', `More actions for ${label}`)
        .attr('title', 'More actions')
        .attr('aria-expanded', String(contextAction.expanded))
        .attr('data-flow-no-drag', '')
        .disabled(contextAction.disabled)
        .style(
          rows
            ? {
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                background: 'light-dark(#fff, #1c2d3c)',
                color: 'light-dark(#1e3a8a, #c4d9ff)',
                width: '38px',
              }
            : {
                position: 'relative',
                width: '36px',
                minHeight: '36px',
                flexShrink: '0',
                cursor: 'pointer',
              },
        )
        .on('click', onEvent(contextAction.event))
        .children('⋯')
    : null;
  if (rows)
    return h.li
      .key(entry.edge.id)
      .style({
        display: 'flex',
        gap: '5px',
        background: entry.selected
          ? 'light-dark(#dbeafe, #253b58)'
          : 'light-dark(#f8fafc, #1b2d3d)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid #bfdbfe',
      })
      .children(selection, actions);
  return actions
    ? h.span
        .key(entry.edge.id)
        .style({ display: 'inline-flex', gap: '4px', marginRight: '8px' })
        .children(selection, actions)
    : selection;
}

type Connections = Readonly<{
  id: string;
  context: ZlozConnectionsContext;
  expanded: boolean;
  rows: boolean;
  modelId: string;
  epoch: number;
}>;

export const nativeConnections = architectureNativePanel<Connections>(
  (h, { id, context, expanded, rows, modelId, epoch }, request) => {
    const onEvent = (message: EditorEvent) =>
      request(Message.ObservedModelInput({ modelId, epoch, message }));
    const list = () => {
      const entries = context.entries.map((entry) =>
        connectionEntry(h, entry, context, rows, onEvent),
      );
      return h.div
        .attr('id', id)
        .attr('data-flow-connections', context.compact ? 'compact' : 'expanded')
        .attr('role', 'group')
        .attr('aria-label', 'Connections')
        .onMount(focusEdgeActions())
        .children(
          ...(rows
            ? [
                h.ul
                  .class('connection-rows')
                  .attr('role', 'list')
                  .style({
                    display: 'grid',
                    gap: '5px',
                    margin: '8px 0',
                    padding: '0',
                    listStyle: 'none',
                    maxWidth: '420px',
                  })
                  .children(...entries),
              ]
            : entries),
        );
    };
    return context.compact
      ? h.div.children(
          h.button
            .attr('type', 'button')
            .attr('data-flow-connections-toggle', '')
            .attr('aria-expanded', String(expanded))
            .attr('aria-controls', expanded ? id : undefined)
            .style({ minHeight: '36px', padding: '6px 10px' })
            .on('click', onEvent({ type: 'ConnectionListToggled' }))
            .children('Connections'),
          expanded ? list() : null,
        )
      : list();
  },
);
