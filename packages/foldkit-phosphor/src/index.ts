import type { Html, HtmlBuilder } from 'foldkit/html';

import type { PhosphorElement, PhosphorAttributes, PhosphorIconDefinition } from './types';
export type { PhosphorIconDefinition, PhosphorElement, PhosphorAttributes } from './types';
export type PhosphorIconOptions<M> = Readonly<{
  size?: number | string;
  colour?: string;
  label?: string;
  mirrored?: boolean;
  attributes?: Parameters<HtmlBuilder<M>['svg']>[0];
}>;
const isNumericSize = (size: number | string): size is number => typeof size === 'number';
function attributes<M>(h: HtmlBuilder<M>, values: PhosphorAttributes) {
  return Object.entries(values).map(([name, value]) => h.Attribute(name, value));
}
function element<M>(h: HtmlBuilder<M>, node: PhosphorElement): Html {
  return h[node.tag](
    attributes(h, node.attributes),
    node.children.map((child) => element(h, child)),
  );
}
/** Pure view composition. Compile static artwork outside the view, and use its parent's h. */
export function phosphorIcon<M>(
  h: HtmlBuilder<M>,
  definition: PhosphorIconDefinition,
  options: PhosphorIconOptions<M> = {},
): Html {
  const size = options.size ?? 24;
  if (
    (isNumericSize(size) && (!Number.isFinite(size) || size <= 0)) ||
    (!isNumericSize(size) && size.trim() === '')
  )
    throw new RangeError('Phosphor icon size must be a positive number or nonempty CSS length');
  if (options.label !== undefined && options.label.trim() === '')
    throw new RangeError('Phosphor icon label must be nonempty when supplied');
  const artwork = definition.children.map((child) => element(h, child));
  return h.svg(
    [
      h.Fill('currentColor'),
      ...attributes(h, definition.attributes),
      ...(options.attributes ?? []),
      h.ViewBox(definition.viewBox),
      h.Width(String(size)),
      h.Height(String(size)),
      h.Attribute('focusable', 'false'),
      ...(options.label === undefined
        ? [h.AriaHidden(true)]
        : [h.Role('img'), h.AriaLabel(options.label), h.AriaHidden(false)]),
      ...(options.colour === undefined ? [] : [h.Style({ color: options.colour })]),
    ],
    options.mirrored ? [h.g([h.Transform('translate(256 0) scale(-1 1)')], artwork)] : artwork,
  );
}
