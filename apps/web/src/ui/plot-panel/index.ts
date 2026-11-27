import { chartKeyDown } from '@opsydyn/foldkit-viz/foldkit/keyboard';
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { Effect, Option, Schema } from 'effect';
import { CustomElement, Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return, ReturnWithOutMessage } from 'foldkit/update';

import { withAriaLive } from '../shared';
import {
  init as initPanel,
  MessageFields,
  update as updatePanel,
  type InitConfig,
  type Model,
  OutMessageFields,
} from './core';
import { attachPointer, POINTER_EVENT, PointerFact } from './pointer';
import { presentationOf, type ViewConfig } from './presentation';

export * from './core';
export type { ViewConfig } from './presentation';

export const Message = defineMessageUnion(MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion(OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const init: (config: InitConfig) => Return<Model, Message> = initPanel;
export const update: (
  model: Model,
  message: Message,
) => ReturnWithOutMessage<Model, Message, OutMessage> = updatePanel;

const panelEvents = CustomElement.define({
  tag: 'foldkit-plot-panel',
  properties: {},
  events: { [POINTER_EVENT]: PointerFact },
});

export const ForwardPointer = Mount.define('ForwardPlotPanelPointer', {
  args: { width: Schema.Number, height: Schema.Number },
  messages: [Message.CompletedForwardPointer],
  execute: ({ element, width, height }) => {
    const listen = Effect.sync(() => attachPointer(element, { width, height }));
    return Effect.acquireRelease(listen, (detach) => Effect.sync(detach)).pipe(
      Effect.map(() => Message.CompletedForwardPointer()),
      Effect.withSpan('ForwardPlotPanelPointer'),
    );
  },
});

export const view = <M>(config: ViewConfig<M>, h: HtmlBuilder<M>): Html => {
  const { model, toParentMessage, ariaLabel } = config;
  const panel = panelEvents.withMessage(h);
  const { geometry, options, liveText } = presentationOf(config);
  const chart = plotChart(h, geometry, options);
  const handleKeyDown = chartKeyDown((command) =>
    toParentMessage(Message.PressedKeyNav({ command })),
  );
  return h.div(
    [
      h.Class('plot-panel'),
      h.Role('application'),
      h.AriaLabel(ariaLabel),
      h.Attribute('aria-roledescription', 'interactive chart'),
      h.Tabindex(0),
      h.OnKeyDownPreventDefault(handleKeyDown),
      h.Style({ cursor: model.brush ? 'crosshair' : 'pointer', 'touch-action': 'none' }),
      h.OnMount(
        Mount.mapMessage(
          ForwardPointer({ width: geometry.width, height: geometry.height }),
          toParentMessage,
        ),
      ),
      panel.OnPlotPanelPointer(({ x, y, pressed }) =>
        toParentMessage(
          pressed ? Message.PressedPointer({ x, y }) : Message.MovedPointer({ x, y }),
        ),
      ),
      h.OnPointerLeave(() => Option.some(toParentMessage(Message.LeftPlot()))),
      h.OnPointerUp(() => Option.some(toParentMessage(Message.ReleasedPointer()))),
    ],
    [withAriaLive(h, chart, liveText)],
  );
};
