import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { Option } from 'effect';

type H<M> = ReturnType<typeof html<M>>;

export type SvgRootConfig = Readonly<{
  width: number;
  height: number;
  ariaLabel: string;
  /** Set true to add keyboard focus + keydown handler */
  interactive?: boolean;
  /** Extra inline style properties merged onto the svg element */
  style?: Record<string, string>;
}>;

export function svgRoot<M>(
  h: H<M>,
  config: SvgRootConfig,
  handleKeyDown: ((key: string) => Option.Option<M>) | null,
  children: ReadonlyArray<Html>,
): Html {
  const { width, height, ariaLabel, interactive = false, style } = config;

  const attrs = [
    h.ViewBox(`0 0 ${width} ${height}`),
    h.Width('100%'),
    h.Role('img'),
    h.AriaLabel(ariaLabel),
    h.Style({ display: 'block', outline: 'none', 'font-family': 'inherit', ...style }),
    ...(interactive ? [h.Tabindex(0)] : []),
    ...(interactive && handleKeyDown ? [h.OnKeyDownPreventDefault(handleKeyDown)] : []),
  ];

  return h.svg(attrs, children);
}
