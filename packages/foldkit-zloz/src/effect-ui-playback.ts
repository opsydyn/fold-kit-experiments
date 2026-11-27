import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

import {
  editionScrubberRequest,
  type ZlozEditionScrubberContext,
  type ZlozEditionSeekRequest,
} from './edition-scrubber';
import type {
  ZlozPlaybackControl,
  ZlozPlaybackControlEvent,
  ZlozPlaybackControlName,
  ZlozPlaybackControlsContext,
} from './playback-controls';

type Decorate<M, Tag extends 'button' | 'div' | 'input' | 'output' | 'p'> = (
  element: Html.H<M>[Tag],
) => ReturnType<Html.H<M>[Tag]['class']>;
type Slot<M> = View.Content<M> | null | undefined;
type Seek<M> = (request: ZlozEditionSeekRequest) => M;
type Send<M> = (event: ZlozPlaybackControlEvent) => M;

export type ZlozPlaybackTextOptions = Readonly<{ label?: string }>;

export type ZlozPlaybackControlsParts<M> = Readonly<{
  controls: readonly View.Content<M>[];
  status: View.Content<M> | null;
  reason: View.Content<M> | null;
}>;

export type ZlozPlaybackControlsViewOptions<M> = Readonly<{
  decorate?: Decorate<M, 'div'>;
  label?: string;
  statusLabel?: string;
  reasonLabel?: string;
  controls?: readonly ZlozPlaybackControlName[];
  renderControl?: (action: ZlozPlaybackControl, h: Html.H<M>, onEvent: Send<M>) => Slot<M>;
  renderStatus?: (context: ZlozPlaybackControlsContext, h: Html.H<M>) => Slot<M>;
  renderReason?: (context: ZlozPlaybackControlsContext, h: Html.H<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozPlaybackControlsParts<M>,
    context: ZlozPlaybackControlsContext,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

export function playbackControl<M>(
  h: Html.H<M>,
  action: ZlozPlaybackControl,
  onEvent: Send<M>,
  decorate?: Decorate<M, 'button'>,
  children: View.Children<M, never> = [action.label],
) {
  return (decorate?.(h.button) ?? h.button)
    .key(action.name)
    .attr('type', 'button')
    .attr('aria-label', action.label)
    .disabled(action.disabled)
    .attr('aria-description', action.reason ?? undefined)
    .attr('title', action.reason ?? undefined)
    .on('click', onEvent(action.event))
    .children(children);
}

export function playbackStatus<M>(
  h: Html.H<M>,
  context: ZlozPlaybackControlsContext,
  decorate?: Decorate<M, 'p'>,
  children: View.Children<M, never> = [context.statusText],
  options: ZlozPlaybackTextOptions = {},
) {
  return (decorate?.(h.p) ?? h.p)
    .attr('role', 'status')
    .attr('aria-live', 'polite')
    .attr('aria-label', options.label?.trim() || 'Edition playback status')
    .children(children);
}

function availability<M>(
  h: Html.H<M>,
  reason: string | null,
  label: string,
  decorate?: Decorate<M, 'p'>,
  children?: View.Children<M, never>,
) {
  return reason === null
    ? null
    : (decorate?.(h.p) ?? h.p)
        .attr('role', 'status')
        .attr('aria-live', 'polite')
        .attr('aria-label', label)
        .children(children ?? [reason]);
}

export function playbackReason<M>(
  h: Html.H<M>,
  context: ZlozPlaybackControlsContext,
  decorate?: Decorate<M, 'p'>,
  children?: View.Children<M, never>,
  options: ZlozPlaybackTextOptions = {},
) {
  return availability(
    h,
    context.reason,
    options.label?.trim() || 'Playback availability',
    decorate,
    children,
  );
}

const order = ['play', 'pause', 'rewind', 'previous', 'next'] as const;

/** Composes native playback controls using the caller's resolved model. */
export function playbackControls<M>(
  h: Html.H<M>,
  context: ZlozPlaybackControlsContext,
  onEvent: Send<M>,
  options: ZlozPlaybackControlsViewOptions<M> = {},
) {
  const controls = [...new Set(options.controls ?? order)].flatMap((name) => {
    const action = context.actions[name];
    const custom = options.renderControl?.(action, h, onEvent);
    const control = custom === undefined ? playbackControl(h, action, onEvent) : custom;
    return control === null ? [] : [control];
  });
  const status = options.renderStatus?.(context, h);
  const reason = options.renderReason?.(context, h);
  const parts = {
    controls,
    status:
      status === undefined
        ? playbackStatus(h, context, undefined, undefined, {
            label: options.statusLabel ?? 'Edition playback status',
          })
        : status,
    reason:
      reason === undefined
        ? playbackReason(h, context, undefined, undefined, {
            label: options.reasonLabel ?? 'Playback availability',
          })
        : reason,
  };
  return (options.decorate?.(h.div) ?? h.div)
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || 'Edition playback controls')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.status, ...parts.controls, parts.reason],
    );
}

export type ZlozEditionScrubberParts<M> = Readonly<{
  input: View.Content<M> | null;
  readout: View.Content<M> | null;
  reason: View.Content<M> | null;
  open: View.Content<M> | null;
}>;

export type ZlozEditionScrubberViewOptions<M> = Readonly<{
  decorate?: Decorate<M, 'div'>;
  label?: string;
  readoutLabel?: string;
  reasonLabel?: string;
  openLabel?: string;
  renderInput?: (context: ZlozEditionScrubberContext, h: Html.H<M>, onSeek: Seek<M>) => Slot<M>;
  renderReadout?: (context: ZlozEditionScrubberContext, h: Html.H<M>) => Slot<M>;
  renderReason?: (context: ZlozEditionScrubberContext, h: Html.H<M>) => Slot<M>;
  renderOpen?: (context: ZlozEditionScrubberContext, h: Html.H<M>, onSeek: Seek<M>) => Slot<M>;
  renderLayout?: (
    parts: ZlozEditionScrubberParts<M>,
    context: ZlozEditionScrubberContext,
    h: Html.H<M>,
  ) => View.Input<M>;
}>;

/** Native keyboard input emits an edition identity resolved by the controller. */
export function editionScrubberInput<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  onSeek: Seek<M>,
  decorate?: Decorate<M, 'input'>,
) {
  return (decorate?.(h.input) ?? h.input)
    .key('edition-scrubber')
    .attr('type', 'range')
    .attr('min', '0')
    .attr('max', String(Math.max(0, context.entries.length - 1)))
    .attr('step', '1')
    .value(String(context.current?.index ?? 0))
    .attr('aria-label', context.label)
    .attr('aria-valuetext', context.valueText)
    .disabled(context.rangeReason !== null)
    .attr('aria-description', context.rangeReason ?? undefined)
    .attr('title', context.rangeReason ?? undefined)
    .on('input', ({ value }) => onSeek(editionScrubberRequest(context, value)));
}

/** The focused range announces the edition. Keep the accompanying readout non-live. */
export function editionScrubberReadout<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  decorate?: Decorate<M, 'output'>,
  children: View.Children<M, never> = [context.valueText],
  options: ZlozPlaybackTextOptions = {},
) {
  return (decorate?.(h.output) ?? h.output)
    .attr('aria-label', options.label?.trim() || 'Selected edition')
    .attr('aria-live', 'off')
    .children(children);
}

export function editionScrubberReason<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  decorate?: Decorate<M, 'p'>,
  children?: View.Children<M, never>,
  options: ZlozPlaybackTextOptions = {},
) {
  return availability(
    h,
    context.rangeReason,
    options.label?.trim() || 'Edition seek availability',
    decorate,
    children,
  );
}

/** Explicit opening also works when the current edition is the only one. */
export function editionSeekButton<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  onSeek: Seek<M>,
  decorate?: Decorate<M, 'button'>,
  children: View.Children<M, never> = ['Open edition'],
  options: ZlozPlaybackTextOptions = {},
) {
  return (decorate?.(h.button) ?? h.button)
    .attr('type', 'button')
    .attr('aria-label', options.label?.trim() || 'Open edition')
    .disabled(context.reason !== null || context.current === null)
    .attr('aria-description', context.reason ?? undefined)
    .on('click', onSeek({ editionId: context.current?.editionId ?? null }))
    .children(children);
}

/** An undefined slot uses the default. A null slot omits the part. */
export function editionScrubber<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  onSeek: Seek<M>,
  options: ZlozEditionScrubberViewOptions<M> = {},
) {
  const input = options.renderInput?.(context, h, onSeek);
  const readout = options.renderReadout?.(context, h);
  const reason = options.renderReason?.(context, h);
  const open = options.renderOpen?.(context, h, onSeek);
  const openLabel = options.openLabel ?? 'Open edition';
  const parts = {
    input: input === undefined ? editionScrubberInput(h, context, onSeek) : input,
    readout:
      readout === undefined
        ? editionScrubberReadout(h, context, undefined, undefined, {
            label: options.readoutLabel ?? 'Selected edition',
          })
        : readout,
    reason:
      reason === undefined
        ? editionScrubberReason(h, context, undefined, undefined, {
            label: options.reasonLabel ?? 'Edition seek availability',
          })
        : reason,
    open:
      open === undefined
        ? editionSeekButton(h, context, onSeek, undefined, [openLabel], { label: openLabel })
        : open,
  };
  return (options.decorate?.(h.div) ?? h.div)
    .attr('role', 'group')
    .attr('aria-label', options.label?.trim() || 'Edition scrubber')
    .children(
      options.renderLayout
        ? options.renderLayout(parts, context, h)
        : [parts.input, parts.readout, parts.open, parts.reason],
    );
}
