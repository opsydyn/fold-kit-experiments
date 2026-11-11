import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozContextMapRelationship,
  ZlozContextMapParticipant,
  ZlozContextMapBadge,
} from './context-map';
import { zlozEdgeLabelBadge, type ZlozEdgeLabelContext } from './edge-label';
import type { ZlozEdgeRenderContext } from './foldkit';
import type { EditorEvent } from './types';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Part<M> = (
  relationship: ZlozContextMapRelationship,
  h: HtmlBuilder<M>,
) => Html | null | undefined;
export type ZlozContextMapConnectorOptions<M> = Readonly<{
  attributes?: Parameters<HtmlBuilder<M>['path']>[0];
  /** Undefined keeps the supplied target marker; null suppresses it. Symmetric/unknown meaning has no arrow by default. */
  markerEnd?: string | null;
  renderPath?: (
    context: ZlozEdgeRenderContext,
    relationship: ZlozContextMapRelationship,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
}>;
/** Decoration only; the canvas retains canonical geometry, hit target, selection and reconnection. */
export function zlozContextMapConnector<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeRenderContext,
  relationship: ZlozContextMapRelationship,
  options: ZlozContextMapConnectorOptions<M> = {},
): Html {
  const custom = options.renderPath?.(context, relationship, h);
  if (custom !== undefined) return custom ?? h.g([], []);
  const marker =
    options.markerEnd === undefined
      ? relationship.direction === 'directed'
        ? context.markerEnd
        : null
      : options.markerEnd;
  return h.path(
    [
      ...(options.attributes ?? []),
      h.DataAttribute('zloz-context-map-edge', context.edge.id),
      h.D(context.path),
      h.Fill('none'),
      h.Stroke(context.stroke),
      h.StrokeWidth(context.strokeWidth),
      h.StrokeDasharray(context.dashArray),
      ...(marker === null ? [] : [h.MarkerEnd(marker)]),
    ],
    [],
  );
}
export type ZlozContextMapLabelParts = Readonly<{
  pattern: Html | null;
  name: Html | null;
  source: Html | null;
  target: Html | null;
  reason: Html | null;
}>;
export type ZlozContextMapLabelOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  renderPattern?: Part<M>;
  renderName?: Part<M>;
  renderReason?: Part<M>;
  renderSource?: (
    participant: ZlozContextMapParticipant,
    relationship: ZlozContextMapRelationship,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderTarget?: (
    participant: ZlozContextMapParticipant,
    relationship: ZlozContextMapRelationship,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozContextMapLabelParts,
    relationship: ZlozContextMapRelationship,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
export type ZlozContextMapParticipantOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  renderName?: (
    participant: ZlozContextMapParticipant,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderBadge?: (badge: ZlozContextMapBadge, h: HtmlBuilder<M>) => Html | null | undefined;
}>;
/** Inert label content. Full badge descriptions remain available to assistive technology. */
export function zlozContextMapParticipant<M>(
  h: HtmlBuilder<M>,
  participant: ZlozContextMapParticipant,
  options: ZlozContextMapParticipantOptions<M> = {},
): Html {
  const name = options.renderName?.(participant, h);
  const badges = participant.badges.flatMap((badge) => {
    const custom = options.renderBadge?.(badge, h);
    const view =
      custom === undefined
        ? h.span(
            [
              h.AriaLabel(badge.description),
              h.Title(badge.description),
              h.Style({
                border: '1px solid var(--flow-node-border, #cbd5e1)',
                borderRadius: '4px',
                padding: '1px 4px',
                fontSize: '10px',
              }),
            ],
            [badge.text],
          )
        : custom;
    return view === null ? [] : [view];
  });
  return h.span(
    [
      h.Style({ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }),
      ...(options.attributes ?? []),
    ],
    [
      ...(name === undefined ? [h.strong([], [participant.name])] : name === null ? [] : [name]),
      ...badges,
    ],
  );
}
/** Compose inert parts inside the existing native edit action; interactive editors remain the host's standard label-editor hook. */
export function zlozContextMapLabel<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeLabelContext,
  relationship: ZlozContextMapRelationship,
  onEvent: (event: EditorEvent) => M,
  options: ZlozContextMapLabelOptions<M> = {},
): Html {
  function part(renderer: Part<M> | undefined, fallback: () => Html | null) {
    const custom = renderer?.(relationship, h);
    return custom === undefined ? fallback() : custom;
  }
  const source = options.renderSource?.(relationship.source, relationship, h),
    target = options.renderTarget?.(relationship.target, relationship, h);
  const parts: ZlozContextMapLabelParts = {
    pattern: part(options.renderPattern, () => h.strong([], [relationship.pattern])),
    name: part(options.renderName, () =>
      context.edge.label ? h.span([h.Style({ fontSize: '12px' })], [context.edge.label]) : null,
    ),
    source:
      source === undefined
        ? relationship.source.badges.length
          ? zlozContextMapParticipant(h, relationship.source)
          : null
        : source,
    target:
      target === undefined
        ? relationship.target.badges.length
          ? zlozContextMapParticipant(h, relationship.target)
          : null
        : target,
    reason: part(options.renderReason, () =>
      relationship.reason
        ? h.span(
            [h.Style({ fontSize: '11px' }), h.Title(relationship.reason)],
            [relationship.reason],
          )
        : null,
    ),
  };
  const content = options.renderLayout?.(parts, relationship, h) ?? [
    ...[parts.pattern, parts.name].filter((part): part is Html => part !== null),
    ...(parts.source || parts.target
      ? [
          h.span(
            [h.Style({ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' })],
            [...[parts.source, parts.target].filter((part): part is Html => part !== null)],
          ),
        ]
      : []),
    ...(parts.reason ? [parts.reason] : []),
  ];
  const participantDescription = (participant: ZlozContextMapParticipant) =>
    `${participant.name}${participant.badges.length ? ` (${participant.badges.map((badge) => badge.description).join(', ')})` : ''}`;
  const description = `${participantDescription(relationship.source)} to ${participantDescription(relationship.target)}: ${relationship.pattern}${relationship.reason ? `. ${relationship.reason}` : ''}`;
  return zlozEdgeLabelBadge(
    h,
    {
      ...context,
      description,
    },
    onEvent,
    [
      h.DataAttribute('zloz-context-map-label', context.edge.id),
      ...(context.readOnly || context.selectionDisabledReason !== undefined
        ? [h.Role('group'), h.AriaLabel(description)]
        : []),
      h.Style({
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '5px',
        alignItems: 'center',
        maxWidth: '410px',
        padding: '8px 12px',
        border: '1px solid var(--flow-node-border, #cbd5e1)',
        borderRadius: '8px',
        background: 'var(--flow-node-background, #fff)',
        color: 'var(--flow-node-color, #172033)',
        fontSize: '12px',
        whiteSpace: 'normal',
      }),
      ...(options.attributes ?? []),
    ],
    content,
  );
}
