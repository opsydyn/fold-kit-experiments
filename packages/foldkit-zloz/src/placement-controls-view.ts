import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import type { ZlozPlacementControlsContext, ZlozPlacementInput } from './placement-controls';
import { ZlozPlacementInputMount } from './placement-input';

type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
type Entry = ZlozPlacementControlsContext['entries'][number];
/** Put palette and canvas under one stable host; nested hosts remain isolated. */
export function zlozPlacementHost<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlacementControlsContext,
  onInput: (input: ZlozPlacementInput) => M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.div(
    [
      ...attributes,
      h.Key('zloz-placement-host'),
      h.DataAttribute('zloz-placement-host', ''),
      h.DataAttribute('zloz-placement-scope', context.scope),
      h.DataAttribute('zloz-placement-generation', String(context.generation)),
      h.DataAttribute('zloz-placement-active', String(context.active)),
      h.DataAttribute('zloz-placement-target-revision', String(context.targetRevision)),
      h.DataAttribute('zloz-placement-step', String(context.step)),
      h.OnMount(
        Mount.mapMessage(ZlozPlacementInputMount(), (message) => {
          // SAFETY: the private Mount emits only ZlozPlacementInput facts.
          return onInput(message.input as ZlozPlacementInput);
        }),
      ),
    ],
    children,
  );
}
/** Native button semantics and delegated pointer/keyboard behavior, with replaceable artwork. */
export function zlozPaletteEntry<M>(
  h: HtmlBuilder<M>,
  entry: Entry,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [entry.label],
): Html {
  return h.div(
    [
      h.Key(entry.id),
      h.DataAttribute('zloz-palette-frame', entry.id),
      h.Style({ display: 'grid', 'touch-action': 'none' }),
    ],
    [
      h.button(
        [
          h.Key(entry.id),
          h.Type('button'),
          h.Style({
            padding: '10px',
            border: '1px solid var(--flow-node-border, #94a3b8)',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            'border-radius': '6px',
            'text-align': 'left',
            'touch-action': 'none',
            cursor: entry.reason ? 'not-allowed' : 'grab',
          }),
          ...attributes,
          h.DataAttribute('zloz-palette-entry', entry.id),
          h.DataAttribute('zloz-palette-selected', String(entry.selected)),
          h.AriaPressed(String(entry.selected)),
          h.Disabled(entry.reason !== null),
          h.AriaLabel(entry.label),
          h.Title(
            entry.reason ?? 'Drag onto the canvas, or activate and use arrows, Enter and Escape.',
          ),
        ],
        children,
      ),
    ],
  );
}
export function zlozPlacementAction<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlacementControlsContext,
  action: 'apply' | 'cancel',
  onInput: (input: ZlozPlacementInput) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children?: Children<M>,
): Html {
  const blocked = action === 'apply' && context.preview.type !== 'ready';
  return h.button(
    [
      h.Type('button'),
      ...attributes,
      h.DataAttribute('zloz-placement-action', action),
      h.Disabled(!context.active || blocked),
      h.OnClick(
        onInput(
          action === 'apply'
            ? {
                type: 'PlacementAccepted',
                scope: context.scope,
                generation: context.generation,
                targetRevision: context.targetRevision,
              }
            : { type: 'PlacementDismissed', scope: context.scope, generation: context.generation },
        ),
      ),
    ],
    children ?? [action === 'apply' ? 'Place fragment' : 'Cancel placement'],
  );
}
export type ZlozPaletteViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  diagnostics?: Pick<ZlozDiagnostics, 'instructions' | 'measurements'>;
  renderEntry?: ((entry: Entry, h: HtmlBuilder<M>) => Html | null | undefined) | undefined;
  renderStatus?: (
    context: ZlozPlacementControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
}>;
/** Native palette; undefined renderer results fall back, null intentionally omits a part. */
export function zlozPalette<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlacementControlsContext,
  onInput: (input: ZlozPlacementInput) => M,
  options: ZlozPaletteViewOptions<M> = {},
): Html {
  const preview = context.preview;
  const status = options.renderStatus?.(context, h);
  return h.div(
    [
      h.Role('group'),
      h.AriaLabel('Placement palette'),
      h.Style({ display: 'grid', gap: '8px' }),
      ...(options.attributes ?? []),
    ],
    [
      ...context.entries.flatMap((entry) => {
        const rendered = options.renderEntry?.(entry, h);
        return [
          ...(rendered === null ? [] : [rendered ?? zlozPaletteEntry(h, entry)]),
          ...(entry.reason ? [h.p([h.Role('status')], [`${entry.label}: ${entry.reason}`])] : []),
        ];
      }),
      ...(context.active
        ? [
            ...(status === null
              ? []
              : [
                  status ??
                    h.p(
                      [h.Role('status'), h.AriaLive('polite')],
                      [
                        preview.type === 'blocked'
                          ? preview.reason
                          : 'Placement preview — choose a destination.',
                      ],
                    ),
                ]),
            ...(options.diagnostics?.instructions === false
              ? []
              : [
                  h.p(
                    [],
                    [
                      'Drag or tap the canvas. Arrows move; Shift accelerates, Alt bypasses snapping, Enter places, Escape cancels.',
                    ],
                  ),
                ]),
            ...(options.diagnostics?.measurements === false || preview.type !== 'ready'
              ? []
              : [
                  h.p(
                    [h.DataAttribute('zloz-placement-readout', '')],
                    [
                      `${Math.round(preview.position.x)}, ${Math.round(preview.position.y)} · ${preview.snap.type}`,
                    ],
                  ),
                ]),
            zlozPlacementAction(h, context, 'apply', onInput),
            zlozPlacementAction(h, context, 'cancel', onInput),
          ]
        : []),
    ],
  );
}
/** Decorative world-space fragment preview; custom renderers may replace this entirely. */
export function zlozPlacementPreview<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlacementControlsContext,
  attributes: Attributes<M> = [],
): Html | null {
  if (context.preview.type !== 'ready') return null;
  return h.div(
    [
      h.DataAttribute('zloz-placement-preview', ''),
      h.AriaHidden(true),
      h.Style({ position: 'absolute', inset: '0', 'pointer-events': 'none' }),
      ...attributes,
    ],
    context.preview.fragment.nodes.map((node) =>
      h.div(
        [
          h.Key(node.id),
          h.Style({
            position: 'absolute',
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            width: `${node.size.width}px`,
            height: `${node.size.height}px`,
            'box-sizing': 'border-box',
            border: '2px dashed var(--flow-selection, #2563eb)',
            background: 'var(--flow-node-background, #fff)',
            color: 'var(--flow-node-color, #172033)',
            opacity: '0.7',
            'border-radius': '8px',
            padding: '10px',
          }),
        ],
        [node.label],
      ),
    ),
  );
}
