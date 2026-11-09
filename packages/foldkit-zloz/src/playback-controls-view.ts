import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  ZlozPlaybackControl,
  ZlozPlaybackControlEvent,
  ZlozPlaybackControlName,
  ZlozPlaybackControlsContext,
} from './playback-controls';

type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozPlaybackTextOptions = Readonly<{ label?: string }>;
export type ZlozPlaybackControlsParts = Readonly<{
  controls: readonly Html[];
  status: Html | null;
  reason: Html | null;
}>;
export type ZlozPlaybackControlsViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  statusLabel?: string;
  reasonLabel?: string;
  /** Ordered visible subset. [] omits controls; duplicates are removed. */
  controls?: readonly ZlozPlaybackControlName[];
  /** Undefined retains a default; null omits that part. Use the native helper to retain semantics. */
  renderControl?: (
    action: ZlozPlaybackControl,
    h: HtmlBuilder<M>,
    onEvent: (event: ZlozPlaybackControlEvent) => M,
  ) => Html | null | undefined;
  renderStatus?: (
    context: ZlozPlaybackControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozPlaybackControlsContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  /** Reorder or wrap parts without changing the named group. Individual helpers also work without this frame. */
  renderLayout?: (
    parts: ZlozPlaybackControlsParts,
    context: ZlozPlaybackControlsContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Unstyled native button; identity, disabled state and reason remain Model-derived. */
export function zlozPlaybackControl<M>(
  h: HtmlBuilder<M>,
  action: ZlozPlaybackControl,
  onEvent: (event: ZlozPlaybackControlEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = [action.label],
): Html {
  return h.button(
    [
      h.Key(action.name),
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      h.Disabled(action.disabled),
      ...(action.reason === null ? [] : [h.AriaDescription(action.reason), h.Title(action.reason)]),
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}
/** Polite status announcement. Custom children can localize or enrich the visible text. */
export function zlozPlaybackStatus<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlaybackControlsContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.statusText],
  options: ZlozPlaybackTextOptions = {},
): Html {
  return h.p(
    [
      ...attributes,
      h.Role('status'),
      h.AriaLive('polite'),
      h.AriaLabel(options.label?.trim() || 'Edition playback status'),
    ],
    children,
  );
}
/** Visible overall availability reason. No wrapper is produced when automatic playback is available. */
export function zlozPlaybackReason<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlaybackControlsContext,
  attributes: Attributes<M> = [],
  children?: Children<M>,
  options: ZlozPlaybackTextOptions = {},
): Html | null {
  return context.reason === null
    ? null
    : h.p(
        [
          ...attributes,
          h.Role('status'),
          h.AriaLive('polite'),
          h.AriaLabel(options.label?.trim() || 'Playback availability'),
        ],
        children ?? [context.reason],
      );
}
const order: readonly ZlozPlaybackControlName[] = ['play', 'pause', 'rewind', 'previous', 'next'];
/** Optional composition over the pure context; owns no timer, state, IDs or lifecycle. */
export function zlozPlaybackControls<M>(
  h: HtmlBuilder<M>,
  context: ZlozPlaybackControlsContext,
  onEvent: (event: ZlozPlaybackControlEvent) => M,
  options: ZlozPlaybackControlsViewOptions<M> = {},
): Html {
  const controls = [...new Set(options.controls ?? order)].flatMap((name) => {
    const action = context.actions[name];
    const custom = options.renderControl?.(action, h, onEvent);
    const control = custom === undefined ? zlozPlaybackControl(h, action, onEvent) : custom;
    return control === null ? [] : [control];
  });
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts = {
    controls,
    status:
      status === undefined
        ? zlozPlaybackStatus(h, context, [], [context.statusText], {
            label: options.statusLabel ?? 'Edition playback status',
          })
        : status,
    reason:
      reason === undefined
        ? zlozPlaybackReason(h, context, [], undefined, {
            label: options.reasonLabel ?? 'Playback availability',
          })
        : reason,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'Edition playback controls'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.status ? [parts.status] : []),
          ...parts.controls,
          ...(parts.reason ? [parts.reason] : []),
        ],
  );
}
