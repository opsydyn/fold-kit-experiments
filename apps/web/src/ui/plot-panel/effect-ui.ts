import { Mount } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { chartCommandOf } from '@opsydyn/foldkit-viz/interaction/keyboard';
import { Effect, Schema } from 'effect';

import { Message } from './core';
import {
  attachPointer,
  EmptyPointerFact,
  LEFT_EVENT,
  POINTER_EVENT,
  PointerFact,
  RELEASED_EVENT,
} from './pointer';
import { presentationOf, type ViewConfig } from './presentation';

const Panel = Html.customElement({
  tag: 'effect-plot-panel',
  events: {
    [POINTER_EVENT]: PointerFact,
    [LEFT_EVENT]: EmptyPointerFact,
    [RELEASED_EVENT]: EmptyPointerFact,
  },
});

const ForwardPointer = Mount.make(
  'ForwardPlotPanelPointer',
  { args: { width: Schema.Number, height: Schema.Number } },
  (element: HTMLElement, size) => {
    const listen = Effect.sync(() => attachPointer(element, size));
    return Effect.acquireRelease(listen, (detach) => Effect.sync(detach)).pipe(
      Effect.map(() => Message.CompletedForwardPointer()),
    );
  },
);

export function view<M>(config: ViewConfig<M>, h: Html.H<M>) {
  const { model, toParentMessage, ariaLabel } = config;
  const { geometry, options, liveText } = presentationOf(config);
  return Panel(h)
    .attrs({
      class: 'plot-panel',
      role: 'application',
      'aria-label': ariaLabel,
      'aria-roledescription': 'interactive chart',
      tabindex: '0',
    })
    .style({ display: 'block', cursor: model.brush ? 'crosshair' : 'pointer', touchAction: 'none' })
    .on(
      'keydown',
      ({ key, ctrl, alt, meta, composing }) => {
        const command = composing
          ? undefined
          : chartCommandOf(key, { ctrlKey: ctrl, altKey: alt, metaKey: meta });
        return command === undefined
          ? undefined
          : toParentMessage(Message.PressedKeyNav({ command }));
      },
      { preventDefault: true },
    )
    .onMount(
      Mount.map(
        ForwardPointer({ width: geometry.width, height: geometry.height }),
        toParentMessage,
      ),
    )
    .on(POINTER_EVENT, ({ x, y, pressed }) =>
      toParentMessage(pressed ? Message.PressedPointer({ x, y }) : Message.MovedPointer({ x, y })),
    )
    .on(LEFT_EVENT, toParentMessage(Message.LeftPlot()))
    .on(RELEASED_EVENT, toParentMessage(Message.ReleasedPointer()))
    .children(
      h.div.style({ position: 'relative' }).children(
        plotChart(h, geometry, options),
        h.div
          .attrs({ 'aria-live': 'polite', 'aria-atomic': 'true' })
          .style({
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: '0',
          })
          .children(liveText),
      ),
    );
}
