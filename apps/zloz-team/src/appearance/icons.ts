import { phosphorIcon } from '@opsydyn/foldkit-phosphor';
import type { HtmlBuilder } from 'foldkit/html';

import { icons } from './icon-data';
export type TeamIcon = keyof typeof icons;
export const teamIcon = <Message>(h: HtmlBuilder<Message>, name: TeamIcon, size = 20) =>
  phosphorIcon(h, icons[name], { size, attributes: [h.Class('team-icon')] });
