import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

export type SvgRootConfig = Readonly<{
  width: number;
  height: number;
  ariaLabel: string;
  role?: 'img' | 'group';
}>;

export function svgRoot<M>(
  h: Html.H<M>,
  { width, height, ariaLabel, role = 'img' }: SvgRootConfig,
  children: View.Children<M, never>,
) {
  return h
    .el('svg')
    .attrs({
      viewBox: `0 0 ${width} ${height}`,
      width: '100%',
      role,
      'aria-label': ariaLabel,
      style: 'display:block;font-family:inherit;color:var(--chart-label,#888)',
    })
    .children(h.el('title').children(ariaLabel), children);
}
