import type { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';
import type { MountAction } from 'foldkit/mount';

import type { CartesianLayout } from '../chart/cartesian.js';
import type { ChartTheme } from '../chart/theme.js';

export type ChartFrameOptions<M> = Readonly<{
  layout: CartesianLayout;
  title: string;
  description: string;
  theme: ChartTheme;
  interactive?: boolean;
  onMount?: MountAction<M>;
  onKeyDown?: (key: string) => Option.Option<M>;
}>;
export function chartFrame<M>(
  h: HtmlBuilder<M>,
  options: ChartFrameOptions<M>,
  children: ReadonlyArray<Html>,
): Html {
  const { frame } = options.layout;
  return h.svg(
    [
      h.Class('chart-frame'),
      h.ViewBox(`0 0 ${frame.width} ${frame.height}`),
      h.Width('100%'),
      h.Height(String(frame.height)),
      h.Role('img'),
      h.AriaLabel(`${options.title}. ${options.description}`),
      h.Style({
        display: 'block',
        background: options.theme.background,
        color: options.theme.text,
        'font-family': options.theme.fontFamily,
      }),
      ...(options.onMount ? [h.OnMount(options.onMount)] : []),
      ...(options.interactive ? [h.Tabindex(0)] : []),
      ...(options.onKeyDown ? [h.OnKeyDownPreventDefault(options.onKeyDown)] : []),
    ],
    [h.title([], [options.title]), h.desc([], [options.description]), ...children],
  );
}
