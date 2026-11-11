import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozDddRelationshipControlsContext,
  ZlozDddRelationshipRequest,
  ZlozDddUpstreamControl,
} from './ddd-relationship-controls';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type OnRequest<M> = (request: ZlozDddRelationshipRequest) => M;
export type ZlozDddRelationshipControlsParts = Readonly<{
  pattern: Html | null;
  upstream: readonly Html[];
  downstream: Html | null;
  status: Html | null;
  reasons: Html | null;
}>;
export type ZlozDddRelationshipControlsViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  statusLabel?: string;
  reasonsLabel?: string;
  renderPattern?: (
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderUpstream?: (
    control: ZlozDddUpstreamControl,
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderDownstream?: (
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReasons?: (
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozDddRelationshipControlsParts,
    context: ZlozDddRelationshipControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
export function zlozDddRelationshipPatternSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html {
  const edge = context.edge,
    control = context.pattern;
  return h.select(
    [
      ...attributes,
      h.AriaLabel(control.label),
      h.Value(control.value ?? ''),
      h.Disabled(control.reason !== null),
      ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
      ...(edge
        ? [
            h.OnChange((key) =>
              onRequest({
                type: 'PatternSelected',
                edgeId: edge.id,
                revision: context.revision,
                key: key || null,
              }),
            ),
          ]
        : []),
    ],
    control.choices.map((choice) =>
      h.option(
        [
          h.Key(choice.key ?? 'none'),
          h.Value(choice.key ?? ''),
          h.Selected(choice.key === control.value),
          h.Disabled(choice.currentOnly || choice.reason !== null),
          ...(choice.reason || choice.compatibilityReason
            ? [h.Title(choice.reason ?? choice.compatibilityReason ?? '')]
            : []),
        ],
        [choice.label],
      ),
    ),
  );
}
export function zlozDddUpstreamRole<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  control: ZlozDddUpstreamControl,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  const edge = context.edge;
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.AriaLabel(control.label),
    h.Checked(control.checked),
    h.Disabled(control.reason !== null || edge === null),
    ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
    ...(edge
      ? [
          h.OnClick(
            onRequest({
              type: 'UpstreamRoleChanged',
              edgeId: edge.id,
              revision: context.revision,
              role: control.role,
              enabled: !control.checked,
            }),
          ),
        ]
      : []),
  ]);
}
export function zlozDddDownstreamRoleSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html | null {
  const edge = context.edge,
    control = context.downstream;
  if (!control) return null;
  return h.select(
    [
      ...attributes,
      h.AriaLabel(control.label),
      h.Value(control.value ?? ''),
      h.Disabled(control.reason !== null || edge === null),
      ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
      ...(edge
        ? [
            h.OnChange((value) => {
              const choice = control.choices.find((choice) => (choice.value ?? '') === value);
              return onRequest({
                type: 'DownstreamRoleSelected',
                edgeId: edge.id,
                revision: context.revision,
                role: choice ? choice.value : control.value,
              });
            }),
          ]
        : []),
    ],
    control.choices.map((choice) =>
      h.option(
        [
          h.Key(choice.value ?? 'none'),
          h.Value(choice.value ?? ''),
          h.Selected(choice.value === control.value),
          h.Disabled(choice.reason !== null),
          ...(choice.reason ? [h.Title(choice.reason)] : []),
        ],
        [choice.label],
      ),
    ),
  );
}
export function zlozDddRelationshipStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  attributes: Attributes<M> = [],
  label = 'DDD relationship status',
): Html {
  return h.p(
    [...attributes, h.Role('status'), h.AriaLive('polite'), h.AriaLabel(label)],
    [context.statusText],
  );
}
/** Availability and convention diagnostics are displayed independently; neither changes enforcement. */
export function zlozDddRelationshipReasons<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  attributes: Attributes<M> = [],
  label = 'DDD relationship availability',
): Html | null {
  const common = [
    ...new Set(
      [
        context.reason,
        context.pattern.reason,
        context.downstream?.reason ?? null,
        ...context.upstream.map((control) => control.reason),
      ].filter((reason): reason is string => reason !== null),
    ),
  ];
  const choices = context.pattern.choices.filter(
    (choice) => choice.reason !== null || choice.compatibilityReason !== null,
  );
  if (!common.length && !choices.length) return null;
  return h.div(
    [...attributes, h.Role('group'), h.AriaLabel(label)],
    [
      ...common.map((reason) => h.p([], [reason])),
      ...(choices.length
        ? [
            h.ul(
              [],
              choices.map((choice) =>
                h.li(
                  [h.Key(choice.key ?? 'none')],
                  [`${choice.label}: ${choice.reason ?? choice.compatibilityReason}`],
                ),
              ),
            ),
          ]
        : []),
    ],
  );
}
/** Unstyled composition. Undefined retains native defaults; null removes a part. Layout and each control remain independently reusable. */
export function zlozDddRelationshipControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozDddRelationshipControlsContext,
  onRequest: OnRequest<M>,
  options: ZlozDddRelationshipControlsViewOptions<M> = {},
): Html {
  const pattern = options.renderPattern?.(context, h, onRequest),
    downstream = options.renderDownstream?.(context, h, onRequest),
    status = options.renderStatus?.(context, h),
    reasons = options.renderReasons?.(context, h);
  const downstreamSelect =
    downstream === undefined ? zlozDddDownstreamRoleSelect(h, context, onRequest) : null;
  const parts: ZlozDddRelationshipControlsParts = {
    pattern:
      pattern === undefined
        ? h.label(
            [],
            [context.pattern.label, zlozDddRelationshipPatternSelect(h, context, onRequest)],
          )
        : pattern,
    upstream: context.upstream.flatMap((control) => {
      const custom = options.renderUpstream?.(control, context, h, onRequest);
      const view =
        custom === undefined
          ? h.label(
              [h.Key(control.role)],
              [zlozDddUpstreamRole(h, context, control, onRequest), control.label],
            )
          : custom;
      return view === null ? [] : [view];
    }),
    downstream:
      downstream === undefined
        ? context.downstream && downstreamSelect
          ? h.label([], [context.downstream.label, downstreamSelect])
          : null
        : downstream,
    status:
      status === undefined
        ? zlozDddRelationshipStatus(h, context, [], options.statusLabel)
        : status,
    reasons:
      reasons === undefined
        ? zlozDddRelationshipReasons(h, context, [], options.reasonsLabel)
        : reasons,
  };
  const content = options.renderLayout?.(parts, context, h) ?? [
    ...[parts.pattern].filter((part): part is Html => part !== null),
    ...parts.upstream,
    ...[parts.downstream, parts.status, parts.reasons].filter(
      (part): part is Html => part !== null,
    ),
  ];
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label ?? 'DDD relationship controls'),
    ],
    content,
  );
}
