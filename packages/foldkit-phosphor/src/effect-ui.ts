import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';

import {
  preparePhosphorIcon,
  type PhosphorElement,
  type PhosphorIconDefinition,
  type PhosphorIconOptions,
} from './index';

function artwork<M>(h: Html.H<M>, node: PhosphorElement): View.Content<M> {
  const element = Object.entries(node.attributes).reduce(
    (element, [name, value]) => element.attr(name, value),
    h.el(node.tag),
  );
  return element.children(...node.children.map((child) => artwork(h, child)));
}

/** Compose compile-time SVG artwork inside the caller's Effect UI tree. */
export function phosphorIcon<M>(
  h: Html.H<M>,
  definition: PhosphorIconDefinition,
  options: PhosphorIconOptions = {},
) {
  const icon = preparePhosphorIcon(definition, options);
  const svg = Object.entries(icon.attributes).reduce(
    (element, [name, value]) => element.attr(name, value),
    new Html.Element<M>('svg'),
  );
  const painted = icon.colour === undefined ? svg : svg.style({ color: icon.colour });
  return painted.children(...icon.children.map((node) => artwork(h, node)));
}
