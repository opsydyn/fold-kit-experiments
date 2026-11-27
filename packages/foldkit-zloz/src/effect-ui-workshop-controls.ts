import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import type { ZlozWorkshopControlsContext, ZlozWorkshopRequest } from './workshop-controls';

type Context = ZlozWorkshopControlsContext;
type Send<M> = (request: ZlozWorkshopRequest) => M;
type Slot<M> = View.Content<M> | null | undefined;
export type ZlozWorkshopParts<M> = Readonly<{
  role: View.Content<M> | null;
  status: View.Content<M> | null;
  meaning: View.Content<M> | null;
  reasons: View.Content<M> | null;
}>;
export type ZlozWorkshopViewOptions<M> = Readonly<{
  fieldClass?: string;
  label?: string;
  renderRole?: (context: Context, h: Html.H<M>, request: Send<M>) => Slot<M>;
  renderStatus?: (context: Context, h: Html.H<M>, request: Send<M>) => Slot<M>;
  renderMeaning?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderReasons?: (context: Context, h: Html.H<M>) => Slot<M>;
  renderLayout?: (parts: ZlozWorkshopParts<M>, context: Context, h: Html.H<M>) => View.Input<M>;
}>;

export function workshopSelect<M>(
  h: Html.H<M>,
  context: Context,
  part: 'role' | 'status',
  onRequest: Send<M>,
) {
  const control = context[part];
  if (!control) return null;
  const { scope } = context;
  return h.select
    .attr('aria-label', control.label)
    .attr('aria-description', control.reason ?? undefined)
    .attr('title', control.reason ?? undefined)
    .disabled(control.reason !== null || scope === null)
    .on('change', ({ value }) =>
      scope &&
      control.reason === null &&
      control.choices.some((choice) => choice.key === value && choice.reason === null)
        ? onRequest(
            part === 'role'
              ? { ...scope, type: 'RoleSelected', key: value }
              : { ...scope, type: 'StatusSelected', value },
          )
        : undefined,
    )
    .children(
      ...control.choices.map((choice) =>
        h.option
          .key(choice.key)
          .attr('value', choice.key)
          .selected(control.value === choice.key)
          .disabled(choice.reason !== null)
          .children(choice.reason ? [choice.label, ' — ', choice.reason] : choice.label),
      ),
    );
}

export function workshopStatusButton<M>(
  h: Html.H<M>,
  context: Context,
  value: 'open' | 'resolved',
  onRequest: Send<M>,
) {
  const { scope, status } = context;
  const choice = status?.choices.find((entry) => entry.key === value);
  if (!scope || !status || !choice) return null;
  const reason = context.reason ?? status.reason ?? choice.reason;
  return h.button
    .key(value)
    .attr('type', 'button')
    .attr('aria-label', `Set hotspot status to ${choice.label}`)
    .attr('aria-pressed', String(status.value === value))
    .attr('aria-description', reason ?? undefined)
    .attr('title', reason ?? undefined)
    .disabled(reason !== null)
    .on('click', () =>
      reason === null ? onRequest({ ...scope, type: 'StatusSelected', value }) : undefined,
    )
    .children(choice.label);
}

function workshopReasons<M>(h: Html.H<M>, context: Context) {
  const { role, status } = context;
  const restrictions = [
    ...new Set([
      context.reason,
      role.reason,
      status?.reason,
      ...role.choices.map((choice) => choice.reason),
      ...(status?.choices.map((choice) => choice.reason) ?? []),
    ]),
  ].filter((reason) => reason != null);
  return restrictions.length
    ? h.ul
        .attr('aria-label', 'Workshop restrictions')
        .children(...restrictions.map((reason) => h.li.key(reason).children(reason)))
    : null;
}

/** Render authored workshop meaning and emit requests scoped to the displayed node and revision. */
export function workshopControls<M>(
  h: Html.H<M>,
  context: Context,
  onRequest: Send<M>,
  options: ZlozWorkshopViewOptions<M> = {},
) {
  const { role, status, scope } = context;
  const roleControl = options.renderRole?.(context, h, onRequest);
  const statusControl = options.renderStatus?.(context, h, onRequest);
  const meaning = options.renderMeaning?.(context, h);
  const reasons = options.renderReasons?.(context, h);
  const parts = {
    role:
      roleControl === undefined
        ? h.label
            .class(options.fieldClass)
            .children(role.label, workshopSelect(h, context, 'role', onRequest))
        : roleControl,
    status:
      statusControl === undefined
        ? scope &&
          status &&
          h.div
            .attr('role', 'group')
            .attr('aria-label', status.label)
            .style({ display: 'grid', gap: '6px' })
            .children(
              h.span(status.label),
              h.div
                .style({ display: 'flex', gap: '8px' })
                .children(
                  workshopStatusButton(h, context, 'open', onRequest),
                  workshopStatusButton(h, context, 'resolved', onRequest),
                ),
            )
        : statusControl,
    meaning:
      meaning === undefined
        ? h.p
            .attr('role', 'status')
            .attr('aria-live', 'polite')
            .attr('aria-label', 'Workshop meaning')
            .children(context.statusText)
        : meaning,
    reasons: reasons === undefined ? workshopReasons(h, context) : reasons,
  };
  return h.div
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || 'Workshop node controls')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.role, parts.status, parts.meaning, parts.reasons],
    );
}
