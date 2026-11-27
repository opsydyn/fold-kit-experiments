import type { PhosphorElement, PhosphorIconDefinition } from './types';

export type { PhosphorIconDefinition, PhosphorElement, PhosphorAttributes } from './types';

export type PhosphorIconOptions = Readonly<{
  size?: number | string;
  colour?: string;
  label?: string;
  mirrored?: boolean;
  attributes?: Readonly<Record<string, string>>;
}>;

const isNumericSize = (size: number | string): size is number => typeof size === 'number';

export function preparePhosphorIcon(
  definition: PhosphorIconDefinition,
  options: PhosphorIconOptions = {},
) {
  const size = options.size ?? 24;
  if (isNumericSize(size) ? !Number.isFinite(size) || size <= 0 : size.trim() === '')
    throw new RangeError('Phosphor icon size must be a positive number or nonempty CSS length');
  if (options.label !== undefined && options.label.trim() === '')
    throw new RangeError('Phosphor icon label must be nonempty when supplied');

  const children: readonly PhosphorElement[] = options.mirrored
    ? [
        {
          tag: 'g',
          attributes: { transform: 'translate(256 0) scale(-1 1)' },
          children: definition.children,
        },
      ]
    : definition.children;
  const accessible: Readonly<Record<string, string>> =
    options.label === undefined
      ? { 'aria-hidden': 'true' }
      : { role: 'img', 'aria-label': options.label, 'aria-hidden': 'false' };
  return {
    attributes: {
      fill: 'currentColor',
      ...definition.attributes,
      ...options.attributes,
      viewBox: definition.viewBox,
      width: String(size),
      height: String(size),
      focusable: 'false',
      ...accessible,
    },
    colour: options.colour,
    children,
  };
}
