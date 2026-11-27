import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type {
  ZlozDddRelationshipControlsContext,
  ZlozDddRelationshipRequest,
} from './ddd-relationship-controls';

type Context = ZlozDddRelationshipControlsContext;
type Send<M> = (request: ZlozDddRelationshipRequest) => M;
type Upstream = Context['upstream'][number];
type Slot<M> = View.Content<M> | null | undefined;
export type ZlozDddRelationshipControlsParts<M> = Readonly<{
  pattern: View.Content<M> | null;
  upstream: readonly View.Content<M>[];
  downstream: View.Content<M> | null;
  status: View.Content<M> | null;
  reasons: View.Content<M> | null;
}>;
export type ZlozDddRelationshipControlsViewOptions<M> = Readonly<{
  fieldClass?: string;
  patternHeading?: string;
  downstreamHeading?: string;
  showStatus?: boolean;
  undoHint?: string;
  renderPattern?: (context: Context, h: Html.H<M>, request: Send<M>) => Slot<M>;
  renderUpstream?: (control: Upstream, context: Context, h: Html.H<M>, request: Send<M>) => Slot<M>;
  renderDownstream?: (context: Context, h: Html.H<M>, request: Send<M>) => Slot<M>;
  renderStatus?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderReasons?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozDddRelationshipControlsParts<M>,
    context: Context,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

export function dddRelationshipPatternSelect<M>(
  h: Html.H<M>,
  context: Context,
  onRequest: Send<M>,
) {
  const { edge, revision, pattern } = context;
  return h.select
    .attr('aria-label', pattern.label)
    .attr('aria-description', pattern.reason ?? undefined)
    .attr('title', pattern.reason ?? undefined)
    .disabled(pattern.reason !== null || edge === null)
    .on('change', ({ value }) =>
      edge && pattern.reason === null
        ? onRequest({
            type: 'PatternSelected',
            edgeId: edge.id,
            revision,
            key: value || null,
          })
        : undefined,
    )
    .children(
      ...pattern.choices.map((choice) =>
        h.option
          .key(choice.key ?? 'none')
          .attr('value', choice.key ?? '')
          .attr('title', choice.reason ?? choice.compatibilityReason ?? undefined)
          .selected(choice.key === pattern.value)
          .disabled(choice.currentOnly || choice.reason !== null)
          .children(choice.label),
      ),
    );
}

export function dddUpstreamRole<M>(
  h: Html.H<M>,
  context: Context,
  control: Upstream,
  onRequest: Send<M>,
) {
  const { edge, revision } = context;
  return h.input
    .attr('type', 'checkbox')
    .attr('aria-label', control.label)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .checked(control.checked)
    .disabled(control.reason !== null || edge === null)
    .on('change', ({ checked }) =>
      edge && control.reason === null
        ? onRequest({
            type: 'UpstreamRoleChanged',
            edgeId: edge.id,
            revision,
            role: control.role,
            enabled: checked,
          })
        : undefined,
    );
}

export function dddDownstreamRoleSelect<M>(h: Html.H<M>, context: Context, onRequest: Send<M>) {
  const { edge, revision, downstream } = context;
  if (downstream === null) return null;
  return h.select
    .attr('aria-label', downstream.label)
    .attr('aria-description', downstream.reason ?? undefined)
    .attr('title', downstream.reason ?? undefined)
    .disabled(downstream.reason !== null || edge === null)
    .on('change', ({ value }) => {
      const choice = downstream.choices.find((entry) => (entry.value ?? '') === value);
      return edge && downstream.reason === null && choice && choice.reason === null
        ? onRequest({
            type: 'DownstreamRoleSelected',
            edgeId: edge.id,
            revision,
            role: choice.value,
          })
        : undefined;
    })
    .children(
      ...downstream.choices.map((choice) =>
        h.option
          .key(choice.value ?? 'none')
          .attr('value', choice.value ?? '')
          .attr('title', choice.reason ?? undefined)
          .selected(choice.value === downstream.value)
          .disabled(choice.reason !== null)
          .children(choice.label),
      ),
    );
}

export function dddRelationshipStatus<M>(h: Html.H<M>, context: Context) {
  return h.p
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', 'DDD relationship status')
    .children(context.statusText);
}

export function dddRelationshipReasons<M>(h: Html.H<M>, context: Context, undoHint?: string) {
  const { pattern, downstream, upstream } = context;
  const commonReasons = [
    ...new Set([
      context.reason,
      pattern.reason,
      downstream?.reason ?? null,
      ...upstream.map(({ reason }) => reason),
    ]),
  ].filter((reason): reason is string => reason !== null);
  const compatibility = pattern.choices.filter(
    (choice) => choice.reason !== null || choice.compatibilityReason !== null,
  );
  return h.div.children(
    commonReasons[0]
      ? h.p.attr('aria-label', 'DDD protection reason').children(commonReasons[0])
      : null,
    undoHint ? h.p.children(undoHint) : null,
    commonReasons.length || compatibility.length
      ? h.details.children(
          h.summary.children('Pattern compatibility details'),
          h.div
            .attr('role', 'group')
            .attr('aria-label', 'DDD relationship availability')
            .children(
              ...commonReasons.map((reason) => h.p.key(reason).children(reason)),
              compatibility.length
                ? h.ul.children(
                    ...compatibility.map((choice) =>
                      h.li
                        .key(choice.key ?? 'none')
                        .children(choice.label, ': ', choice.reason ?? choice.compatibilityReason),
                    ),
                  )
                : null,
            ),
        )
      : null,
  );
}

export function dddRelationshipControls<M>(
  h: Html.H<M>,
  context: Context,
  onRequest: Send<M>,
  options: ZlozDddRelationshipControlsViewOptions<M> = {},
) {
  const { pattern, downstream, upstream } = context;
  const patternControl = options.renderPattern?.(context, h, onRequest);
  const downstreamControl = options.renderDownstream?.(context, h, onRequest);
  const status = options.showStatus === false ? null : options.renderStatus?.(context, h);
  const reasons = options.renderReasons?.(context, h);
  const upstreamControls = upstream
    .map((control) => {
      const custom = options.renderUpstream?.(control, context, h, onRequest);
      return custom === undefined
        ? h.label
            .key(control.role)
            .style({ display: 'flex', gap: '8px', alignItems: 'center' })
            .children(dddUpstreamRole(h, context, control, onRequest), h.span(control.label))
        : custom;
    })
    .filter((part) => part !== null);
  const parts = {
    pattern:
      patternControl === undefined
        ? h.label
            .class(options.fieldClass)
            .children(
              options.patternHeading ? h.strong(options.patternHeading) : pattern.label,
              dddRelationshipPatternSelect(h, context, onRequest),
            )
        : patternControl,
    upstream: upstreamControls,
    downstream:
      downstreamControl === undefined
        ? downstream &&
          h.label
            .class(options.fieldClass)
            .children(
              options.downstreamHeading ?? downstream.label,
              dddDownstreamRoleSelect(h, context, onRequest),
            )
        : downstreamControl,
    status: status === undefined ? dddRelationshipStatus(h, context) : status,
    reasons: reasons === undefined ? dddRelationshipReasons(h, context, options.undoHint) : reasons,
  };
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'DDD relationship controls')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.pattern, ...parts.upstream, parts.downstream, parts.status, parts.reasons],
    );
}
