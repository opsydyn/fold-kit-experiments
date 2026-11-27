import type { Html } from '@effect/ui/html';
import type { ZlozNode } from '@opsydyn/foldkit-zloz';
import type { NativeNodeShell } from '@opsydyn/foldkit-zloz/effect-ui';

import { c4Appearance } from '../appearance/c4';
import { nodeIcon } from './team-icons';
import { hotspotStatus } from './workshop';

export function nodeShell<M>(
  h: Html.H<M>,
  node: ZlozNode,
  selected: boolean,
  team: string,
  iconFailed: boolean,
  onIconFailure: (icon: string) => M,
): NativeNodeShell<M> {
  const architecture = node.architecture;
  const c4 = architecture?.family === 'c4' ? c4Appearance(architecture) : null;
  const hotspot = hotspotStatus(node);
  const type =
    c4?.label ??
    (architecture
      ? `${architecture.family === 'ddd' ? 'DDD' : 'Event storming'} · ${architecture.role.replaceAll('-', ' ')}`
      : null);

  return {
    className: selected ? 'shared-node is-selected' : 'shared-node',
    outline: false,
    dataAttributes: {
      'data-architecture': architecture?.family ?? 'untyped',
      'data-workshop-role':
        architecture?.family === 'event-storming' ? architecture.role : undefined,
    },
    title: {
      className: 'shared-node-title',
      content: h.lazy(drawTitle, node, team, iconFailed, onIconFailure, c4?.icon, hotspot, type),
    },
  };
}

function drawTitle<M>(
  h: Html.H<M>,
  node: ZlozNode,
  team: string,
  iconFailed: boolean,
  onIconFailure: (icon: string) => M,
  c4Icon: ReturnType<typeof c4Appearance>['icon'] | undefined,
  hotspot: ReturnType<typeof hotspotStatus>,
  type: string | null,
) {
  return h.span.class('shared-node-copy').children(
    h.span
      .class('node-name')
      .children(
        nodeIcon(h, team, iconFailed ? undefined : node.icon, c4Icon ?? 'cube', onIconFailure),
        h.span.children(node.label),
      ),
    hotspot
      ? h.span
          .class('workshop-hotspot')
          .attr('data-hotspot-status', hotspot)
          .children(
            h.span
              .class('workshop-hotspot-flare')
              .attrs({
                'aria-hidden': 'true',
                'data-hotspot-flare': node.id,
                'data-hotspot-state': hotspot,
              })
              .children(),
            hotspot === 'open' ? 'Open question' : '✓ Resolved',
          )
      : type && h.span.class('node-type').children(type),
  );
}
