import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozWorkshopControlsContext, ZlozWorkshopRequest } from './workshop-controls';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type OnRequest<M> = (request: ZlozWorkshopRequest) => M;
export type ZlozWorkshopParts = Readonly<{
  role: Html | null;
  status: Html | null;
  meaning: Html | null;
  reasons: Html | null;
}>;
export type ZlozWorkshopViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  renderRole?: (
    context: ZlozWorkshopControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozWorkshopControlsContext,
    h: HtmlBuilder<M>,
    onRequest: OnRequest<M>,
  ) => Html | null | undefined;
  renderMeaning?: (
    context: ZlozWorkshopControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReasons?: (
    context: ZlozWorkshopControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozWorkshopParts,
    context: ZlozWorkshopControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
export function zlozWorkshopSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozWorkshopControlsContext,
  part: 'role' | 'status',
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['select']>[0] = [],
): Html | null {
  const control = part === 'role' ? context.role : context.status;
  if (!control) return null;
  const scope = context.scope ?? { nodeId: '', revision: -1, descriptor: '' };
  return h.select(
    [
      ...attributes,
      h.AriaLabel(control.label),
      h.Value(control.value),
      h.Disabled(control.reason !== null),
      ...(control.reason ? [h.AriaDescription(control.reason), h.Title(control.reason)] : []),
      h.OnChange((value) =>
        onRequest(
          part === 'role'
            ? { ...scope, type: 'RoleSelected', key: value }
            : { ...scope, type: 'StatusSelected', value },
        ),
      ),
    ],
    control.choices.map((c) =>
      h.option(
        [
          h.Key(c.key),
          h.Value(c.key),
          h.Selected(c.key === control.value),
          h.Disabled(c.reason !== null),
        ],
        [c.reason ? `${c.label} — ${c.reason}` : c.label],
      ),
    ),
  );
}
/** Explicit semantic actions retain native Tab/Enter/Space behavior and live protection. */
export function zlozWorkshopStatusButton<M>(
  h: HtmlBuilder<M>,
  context: ZlozWorkshopControlsContext,
  value: 'open' | 'resolved',
  onRequest: OnRequest<M>,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
): Html | null {
  const control = context.status,
    scope = context.scope,
    choice = control?.choices.find((c) => c.key === value);
  if (!control || !scope || !choice) return null;
  const reason = context.reason ?? choice.reason;
  return h.button(
    [
      ...attributes,
      h.Key(value),
      h.Type('button'),
      h.AriaLabel(`Set hotspot status to ${choice.label}`),
      h.AriaPressed(String(control.value === value)),
      h.Disabled(reason !== null),
      ...(reason ? [h.AriaDescription(reason), h.Title(reason)] : []),
      h.OnClick(onRequest({ ...scope, type: 'StatusSelected', value })),
    ],
    [choice.label],
  );
}
/** Unstyled composition. Semantic status/reasons are independent of numeric diagnostics. */
export function zlozEventStormingWorkshopControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozWorkshopControlsContext,
  onRequest: OnRequest<M>,
  options: ZlozWorkshopViewOptions<M> = {},
): Html {
  function selector(part: 'role' | 'status') {
    const control = part === 'role' ? context.role : context.status;
    if (!control) return null;
    const custom = (part === 'role' ? options.renderRole : options.renderStatus)?.(
      context,
      h,
      onRequest,
    );
    return custom === undefined
      ? part === 'status'
        ? h.div(
            [h.Role('group'), h.AriaLabel(control.label)],
            [
              h.span([], [control.label]),
              ...(['open', 'resolved'] as const).flatMap((value) => {
                const button = zlozWorkshopStatusButton(h, context, value, onRequest);
                return button ? [button] : [];
              }),
            ],
          )
        : h.label([], [control.label, zlozWorkshopSelect(h, context, part, onRequest)!])
      : custom;
  }
  const meaning = options.renderMeaning?.(context, h),
    reasons = options.renderReasons?.(context, h);
  const denied = [
    ...new Set(
      [
        context.reason,
        context.role.reason,
        context.status?.reason,
        ...context.role.choices.map((c) => c.reason),
        ...(context.status?.choices.map((c) => c.reason) ?? []),
      ].filter((r): r is string => r != null),
    ),
  ];
  const parts: ZlozWorkshopParts = {
    role: selector('role'),
    status: selector('status'),
    meaning:
      meaning === undefined
        ? h.p(
            [h.Role('status'), h.AriaLive('polite'), h.AriaLabel('Workshop meaning')],
            [context.statusText],
          )
        : meaning,
    reasons:
      reasons === undefined
        ? denied.length
          ? h.ul(
              [h.AriaLabel('Workshop restrictions')],
              denied.map((r) => h.li([], [r])),
            )
          : null
        : reasons,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'Workshop node controls'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.role ? [parts.role] : []),
          ...(parts.status ? [parts.status] : []),
          ...(parts.meaning ? [parts.meaning] : []),
          ...(parts.reasons ? [parts.reasons] : []),
        ],
  );
}
