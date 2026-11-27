import { preparePhosphorIcon, type PhosphorElement } from '@opsydyn/foldkit-phosphor';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { icons } from './icon-data';

export type TeamIcon = keyof typeof icons;

// Keep the static artwork shared while the Teams view still uses its original builder.
function artwork<Message>(h: HtmlBuilder<Message>, node: PhosphorElement): Html {
  return h[node.tag](
    Object.entries(node.attributes).map(([name, value]) => h.Attribute(name, value)),
    node.children.map((child) => artwork(h, child)),
  );
}

export function teamIcon<Message>(h: HtmlBuilder<Message>, name: TeamIcon, size = 20): Html {
  const icon = preparePhosphorIcon(icons[name], { size, attributes: { class: 'team-icon' } });
  const { viewBox, ...attributes } = icon.attributes;
  return h.svg(
    [
      ...Object.entries(attributes).map(([name, value]) => h.Attribute(name, value)),
      h.ViewBox(viewBox),
    ],
    icon.children.map((child) => artwork(h, child)),
  );
}
