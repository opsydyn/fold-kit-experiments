import type { Html, HtmlBuilder } from 'foldkit/html';

import {
  editionScrubberRequest,
  type ZlozEditionScrubberContext,
  type ZlozEditionSeekRequest,
} from './edition-scrubber';
import type { ZlozPlaybackTextOptions } from './playback-controls-view';

type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];
export type ZlozEditionScrubberParts = Readonly<{
  input: Html | null;
  readout: Html | null;
  reason: Html | null;
  open: Html | null;
}>;
export type ZlozEditionScrubberViewOptions<M> = Readonly<{
  attributes?: Attributes<M>;
  label?: string;
  readoutLabel?: string;
  reasonLabel?: string;
  openLabel?: string;
  renderInput?: (
    context: ZlozEditionScrubberContext,
    h: HtmlBuilder<M>,
    onSeek: (request: ZlozEditionSeekRequest) => M,
  ) => Html | null | undefined;
  renderReadout?: (
    context: ZlozEditionScrubberContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderReason?: (
    context: ZlozEditionScrubberContext,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderOpen?: (
    context: ZlozEditionScrubberContext,
    h: HtmlBuilder<M>,
    onSeek: (request: ZlozEditionSeekRequest) => M,
  ) => Html | null | undefined;
  renderLayout?: (
    parts: ZlozEditionScrubberParts,
    context: ZlozEditionScrubberContext,
    h: HtmlBuilder<M>,
  ) => readonly Html[];
}>;
/** Controlled native range. Arrows/Home/End use browser semantics and emit identity requests. */
export function zlozEditionScrubberInput<M>(
  h: HtmlBuilder<M>,
  context: ZlozEditionScrubberContext,
  onSeek: (request: ZlozEditionSeekRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0] = [],
): Html {
  return h.input([
    h.Key('edition-scrubber'),
    ...attributes,
    h.Type('range'),
    h.Min('0'),
    h.Max(String(Math.max(0, context.entries.length - 1))),
    h.Step('1'),
    h.Value(String(context.current?.index ?? 0)),
    h.AriaLabel(context.label),
    h.AriaValuetext(context.valueText),
    h.Disabled(context.rangeReason !== null),
    ...(context.rangeReason === null
      ? []
      : [h.AriaDescription(context.rangeReason), h.Title(context.rangeReason)]),
    h.OnInput((value) => onSeek(editionScrubberRequest(context, value))),
  ]);
}
/** Visible readout stays non-live: the focused native range already announces its value text. */
export function zlozEditionScrubberReadout<M>(
  h: HtmlBuilder<M>,
  context: ZlozEditionScrubberContext,
  attributes: Attributes<M> = [],
  children: Children<M> = [context.valueText],
  options: ZlozPlaybackTextOptions = {},
): Html {
  return h.output(
    [...attributes, h.AriaLabel(options.label?.trim() || 'Selected edition'), h.AriaLive('off')],
    children,
  );
}
export function zlozEditionScrubberReason<M>(
  h: HtmlBuilder<M>,
  context: ZlozEditionScrubberContext,
  attributes: Attributes<M> = [],
  children?: Children<M>,
  options: ZlozPlaybackTextOptions = {},
): Html | null {
  return context.rangeReason === null
    ? null
    : h.p(
        [
          ...attributes,
          h.Role('status'),
          h.AriaLive('polite'),
          h.AriaLabel(options.label?.trim() || 'Edition seek availability'),
        ],
        children ?? [context.rangeReason],
      );
}
/** Explicitly open the current point, including a single edition or an unchanged first position. */
export function zlozEditionSeekButton<M>(
  h: HtmlBuilder<M>,
  context: ZlozEditionScrubberContext,
  onSeek: (request: ZlozEditionSeekRequest) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0] = [],
  children: Children<M> = ['Open edition'],
  options: ZlozPlaybackTextOptions = {},
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(options.label?.trim() || 'Open edition'),
      h.Disabled(context.reason !== null || context.current === null),
      ...(context.reason === null ? [] : [h.AriaDescription(context.reason)]),
      h.OnClick(onSeek({ editionId: context.current?.editionId ?? null })),
    ],
    children,
  );
}
/** Unstyled composition; undefined keeps defaults, null omits a part. No timer or draft state is created. */
export function zlozEditionScrubber<M>(
  h: HtmlBuilder<M>,
  context: ZlozEditionScrubberContext,
  onSeek: (request: ZlozEditionSeekRequest) => M,
  options: ZlozEditionScrubberViewOptions<M> = {},
): Html {
  const input = options.renderInput?.(context, h, onSeek);
  const readout = options.renderReadout?.(context, h);
  const reason = options.renderReason?.(context, h);
  const open = options.renderOpen?.(context, h, onSeek);
  const parts = {
    input: input === undefined ? zlozEditionScrubberInput(h, context, onSeek) : input,
    readout:
      readout === undefined
        ? zlozEditionScrubberReadout(h, context, [], [context.valueText], {
            label: options.readoutLabel ?? 'Selected edition',
          })
        : readout,
    reason:
      reason === undefined
        ? zlozEditionScrubberReason(h, context, [], undefined, {
            label: options.reasonLabel ?? 'Edition seek availability',
          })
        : reason,
    open:
      open === undefined
        ? zlozEditionSeekButton(h, context, onSeek, [], [options.openLabel ?? 'Open edition'], {
            label: options.openLabel ?? 'Open edition',
          })
        : open,
  };
  return h.div(
    [
      ...(options.attributes ?? []),
      h.Role('group'),
      h.AriaLabel(options.label?.trim() || 'Edition scrubber'),
    ],
    options.renderLayout
      ? options.renderLayout(parts, context, h)
      : [
          ...(parts.input ? [parts.input] : []),
          ...(parts.readout ? [parts.readout] : []),
          ...(parts.open ? [parts.open] : []),
          ...(parts.reason ? [parts.reason] : []),
        ],
  );
}
