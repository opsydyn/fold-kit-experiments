import type { Option } from 'effect';
import type { Html, html } from 'foldkit/html';

type H<M> = ReturnType<typeof html<M>>;

export type SvgRootConfig = Readonly<{
  width: number;
  height: number;
  ariaLabel: string;
  /** Optional extended description for screen readers (maps to SVG <desc>) */
  ariaDescription?: string;
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
  const { width, height, ariaLabel, ariaDescription, interactive = false, style } = config;

  // Interactive charts use role="application" + roledescription so screen readers
  // announce keyboard controls rather than treating the SVG as a static image.
  const role = interactive ? 'application' : 'img';

  const attrs = [
    h.ViewBox(`0 0 ${width} ${height}`),
    h.Width('100%'),
    h.Role(role),
    h.AriaLabel(ariaLabel),
    ...(interactive ? [h.Attribute('aria-roledescription', 'interactive chart')] : []),
    h.Style({
      display: 'block',
      outline: 'none',
      'font-family': 'inherit',
      color: 'var(--chart-label, #888)',
      ...style,
    }),
    ...(interactive ? [h.Tabindex(0)] : []),
    ...(interactive && handleKeyDown ? [h.OnKeyDownPreventDefault(handleKeyDown)] : []),
  ];

  // SVG <title> provides the most reliable accessible name across screen readers.
  // <desc> carries supplementary context when ariaDescription is supplied.
  const a11yChildren: Html[] = [
    h.title([], [ariaLabel]),
    ...(ariaDescription ? [h.desc([], [ariaDescription])] : []),
  ];

  return h.svg(attrs, [...a11yChildren, ...children]);
}
