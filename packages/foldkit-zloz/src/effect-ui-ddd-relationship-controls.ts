import type { Html } from '@effect/ui/html';

import type {
  ZlozDddRelationshipControlsContext,
  ZlozDddRelationshipRequest,
} from './ddd-relationship-controls';

/** Render the package's resolved DDD controls and report requests against the displayed revision. */
export function dddRelationshipControls<M>(
  h: Html.H<M>,
  context: ZlozDddRelationshipControlsContext,
  onRequest: (request: ZlozDddRelationshipRequest) => M,
  options: Readonly<{
    fieldClass?: string;
    patternHeading?: string;
    downstreamHeading?: string;
    showStatus?: boolean;
    undoHint?: string;
  }> = {},
) {
  const { edge, revision, pattern, upstream, downstream } = context;
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
  return h.div
    .attr('role', 'group')
    .attr('aria-label', 'DDD relationship controls')
    .children(
      h.label.class(options.fieldClass).children(
        options.patternHeading ? h.strong.children(options.patternHeading) : pattern.label,
        h.select
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
          ),
      ),
      ...upstream.map((control) =>
        h.label
          .key(control.role)
          .style({ display: 'flex', gap: '8px', alignItems: 'center' })
          .children(
            h.input
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
              ),
            h.span.children(control.label),
          ),
      ),
      downstream
        ? h.label.class(options.fieldClass).children(
            options.downstreamHeading ?? downstream.label,
            h.select
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
              ),
          )
        : null,
      options.showStatus !== false
        ? h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'DDD relationship status')
            .children(context.statusText)
        : null,
      h.div.children(
        commonReasons[0]
          ? h.p.attr('aria-label', 'DDD protection reason').children(commonReasons[0])
          : null,
        options.undoHint ? h.p.children(options.undoHint) : null,
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
                            .children(
                              choice.label,
                              ': ',
                              choice.reason ?? choice.compatibilityReason,
                            ),
                        ),
                      )
                    : null,
                ),
            )
          : null,
      ),
    );
}
