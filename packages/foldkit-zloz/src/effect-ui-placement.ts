import { Mount, type View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { Effect, Queue, Stream } from 'effect';

import { bindPlacementInput } from './bind-placement-input';
import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozPlacementControlsContext, ZlozPlacementInput } from './placement-controls';

const placementInput = Mount.makeStream(
  'ZlozPlacementInput',
  { args: {} },
  (element: HTMLElement) =>
    Stream.callback<ZlozPlacementInput>((queue) => {
      const bind = Effect.sync(() =>
        bindPlacementInput(element, (event) => Queue.offerUnsafe(queue, event)),
      );
      return Effect.acquireRelease(bind, Effect.sync);
    }),
);

/** Keep the palette and graph surface under the same scoped input host. */
export function placementHost<M>(
  h: Html.H<M>,
  context: ZlozPlacementControlsContext,
  onInput: (input: ZlozPlacementInput) => M,
) {
  return h.div
    .key('zloz-placement-host')
    .attr('data-zloz-placement-host', '')
    .attr('data-zloz-placement-scope', context.scope)
    .attr('data-zloz-placement-generation', String(context.generation))
    .attr('data-zloz-placement-active', String(context.active))
    .attr('data-zloz-placement-target-revision', String(context.targetRevision))
    .attr('data-zloz-placement-step', String(context.step))
    .onMount(Mount.map(placementInput(), onInput));
}

type Entry = ZlozPlacementControlsContext['entries'][number];
type Button<M> = Html.H<M>['button'];
type DecorateButton<M> = (button: Button<M>) => ReturnType<Button<M>['class']>;

export type ZlozPaletteViewOptions<M> = Partial<
  Pick<ZlozDiagnostics, 'instructions' | 'measurements'>
> &
  Readonly<{
    entryClass?: string;
    renderEntry?: (entry: Entry, h: Html.H<M>) => View.Content<M> | null | undefined;
    renderStatus?: (
      context: ZlozPlacementControlsContext,
      h: Html.H<M>,
    ) => View.Content<M> | null | undefined;
  }>;

/** Native button; pointer and keyboard activation go through the scoped host. */
export function placementPaletteEntry<M>(
  h: Html.H<M>,
  entry: Entry,
  decorate?: DecorateButton<M>,
  children: View.Children<M, never> = [entry.label],
) {
  return h.div
    .key(entry.id)
    .attr('data-zloz-palette-frame', entry.id)
    .style({ touchAction: 'none' })
    .children(
      (decorate?.(h.button) ?? h.button)
        .attr('type', 'button')
        .attr('aria-label', entry.label)
        .attr('data-zloz-palette-entry', entry.id)
        .attr('data-zloz-palette-selected', String(entry.selected))
        .attr('aria-pressed', String(entry.selected))
        .attr('title', entry.reason ?? 'Drag onto the canvas or use the keyboard.')
        .disabled(entry.reason !== null)
        .children(children),
    );
}

export function placementAction<M>(
  h: Html.H<M>,
  { active, scope, generation, targetRevision, preview }: ZlozPlacementControlsContext,
  action: 'apply' | 'cancel',
  onInput: (input: ZlozPlacementInput) => M,
  decorate?: DecorateButton<M>,
  children: View.Children<M, never> = [action === 'apply' ? 'Place fragment' : 'Cancel placement'],
) {
  return (decorate?.(h.button) ?? h.button)
    .attr('type', 'button')
    .attr('data-zloz-placement-action', action)
    .disabled(!active || (action === 'apply' && preview.type !== 'ready'))
    .on(
      'click',
      onInput(
        action === 'apply'
          ? { type: 'PlacementAccepted', scope, generation, targetRevision }
          : { type: 'PlacementDismissed', scope, generation },
      ),
    )
    .children(children);
}

export function placementPalette<M>(
  h: Html.H<M>,
  context: ZlozPlacementControlsContext,
  onInput: (input: ZlozPlacementInput) => M,
  options?: ZlozPaletteViewOptions<M>,
) {
  const { preview } = context;
  const status = options?.renderStatus?.(context, h);
  return h.div
    .key('placement-palette')
    .class('zloz-ui-palette')
    .attr('role', 'group')
    .attr('aria-label', 'Placement palette')
    .children(
      ...context.entries.map((entry) => {
        const content = options?.renderEntry?.(entry, h);
        return h.div
          .key(entry.id)
          .children(
            content === null
              ? null
              : placementPaletteEntry(
                  h,
                  entry,
                  (button) => button.class(options?.entryClass ?? ''),
                  [content ?? entry.label],
                ),
            entry.reason ? h.p.attr('role', 'status').children(entry.reason) : null,
          );
      }),
      context.active
        ? h.div
            .key('placement-status')
            .class('zloz-ui-palette')
            .children(
              status === undefined
                ? h.p
                    .attr('role', 'status')
                    .attr('aria-live', 'polite')
                    .attr('data-zloz-placement-status', '')
                    .children(
                      preview.type === 'blocked'
                        ? preview.reason
                        : 'Placement preview. Choose a destination.',
                    )
                : status,
              options?.instructions !== false
                ? h.p.children(
                    'Drag onto the canvas or move with arrow keys. Shift accelerates, Alt bypasses snapping, Enter places, and Escape cancels.',
                  )
                : null,
              options?.measurements !== false && preview.type === 'ready'
                ? h.p
                    .attr('data-zloz-placement-readout', '')
                    .children(
                      `${Math.round(preview.position.x)}, ${Math.round(preview.position.y)} · ${preview.snap.type}`,
                    )
                : null,
              h.div
                .class('zloz-ui-placement-actions')
                .children(
                  placementAction(h, context, 'apply', onInput),
                  placementAction(h, context, 'cancel', onInput),
                ),
            )
        : null,
    );
}

/** A decorative preview lives in the transformed graph world. */
export function placementPreview<M>(
  h: Html.H<M>,
  context: ZlozPlacementControlsContext,
  decorate?: (element: Html.H<M>['div']) => ReturnType<Html.H<M>['div']['class']>,
) {
  if (context.preview.type !== 'ready') return;
  return (decorate?.(h.div) ?? h.div)
    .key('placement-preview')
    .class('zloz-ui-placement-preview')
    .attr('data-zloz-placement-preview', '')
    .attr('aria-hidden', 'true')
    .children(
      ...context.preview.fragment.nodes.map(({ id, position, size, label }) =>
        h.div
          .key(id)
          .class('zloz-ui-placement-ghost')
          .style({
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
          })
          .children(label),
      ),
    );
}
