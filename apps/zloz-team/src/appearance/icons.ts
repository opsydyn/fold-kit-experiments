import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { preparePhosphorIcon, type PhosphorElement } from '@opsydyn/foldkit-phosphor';

import { icons } from './icon-data';

export type TeamIcon = keyof typeof icons;

function artwork<Message>(node: PhosphorElement): View.Content<Message> {
  return new Html.Element<Message>(node.tag)
    .attrs(node.attributes)
    .children(...node.children.map((child) => artwork<Message>(child)));
}

export function teamIcon<Message>(_h: Html.H<Message>, name: TeamIcon, size = 20) {
  const icon = preparePhosphorIcon(icons[name], { size, attributes: { class: 'team-icon' } });
  return new Html.Element<Message>('svg')
    .attrs(icon.attributes)
    .children(...icon.children.map((child) => artwork<Message>(child)));
}
