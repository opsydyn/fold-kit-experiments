/** Static Phosphor artwork, independent of a renderer, DOM, Message or runtime. */
export type PhosphorTag =
  | 'g'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'line'
  | 'polyline'
  | 'polygon';
export type PhosphorAttribute =
  | 'd'
  | 'fill'
  | 'fill-rule'
  | 'clip-rule'
  | 'stroke'
  | 'stroke-width'
  | 'stroke-linecap'
  | 'stroke-linejoin'
  | 'stroke-miterlimit'
  | 'stroke-dasharray'
  | 'stroke-dashoffset'
  | 'opacity'
  | 'fill-opacity'
  | 'stroke-opacity'
  | 'transform'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rx'
  | 'ry'
  | 'cx'
  | 'cy'
  | 'r'
  | 'x1'
  | 'x2'
  | 'y1'
  | 'y2'
  | 'points';
export type PhosphorAttributes = Readonly<Partial<Record<PhosphorAttribute, string>>>;
export type PhosphorElement = Readonly<{
  tag: PhosphorTag;
  attributes: PhosphorAttributes;
  children: readonly PhosphorElement[];
}>;
export type PhosphorIconDefinition = Readonly<{
  viewBox: '0 0 256 256';
  attributes: PhosphorAttributes;
  children: readonly PhosphorElement[];
}>;
