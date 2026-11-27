import { Html } from '@effect/ui/html';

import { architectureRoleLabel, type ZlozNodeArchitecture } from './architecture';
import { eventStormingAccent } from './theme';
import type { ZlozNode } from './types';

export function notationStroke(architecture: ZlozNodeArchitecture | undefined) {
  return architecture?.family === 'event-storming' ? eventStormingAccent(architecture) : undefined;
}

export function notationDash(architecture: ZlozNodeArchitecture | undefined, preview: boolean) {
  if (preview || (architecture?.family === 'c4' && architecture.scope === 'external')) return '6 4';
  return architecture?.family === 'event-storming' && architecture.role === 'external-system'
    ? '8 4'
    : undefined;
}

export function notationPrefix(architecture: ZlozNodeArchitecture) {
  return architecture.family === 'event-storming'
    ? 'zloz-event-storming'
    : `flow-${architecture.family}`;
}

function person<M>() {
  const svg = (tag: 'svg' | 'circle' | 'path') => new Html.Element<M>(tag);
  return svg('svg')
    .attr('data-flow-c4-person', '')
    .attr('aria-hidden', 'true')
    .attr('viewBox', '0 0 32 32')
    .attr('width', '28')
    .attr('height', '28')
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', '2')
    .children(
      svg('circle').attr('cx', '16').attr('cy', '9').attr('r', '5'),
      svg('path').attr('d', 'M6,29 V25 A10,10 0 0 1 26,25 V29 Z'),
    );
}

export type NativeNotationLabels = Readonly<{
  badge?: (architecture: ZlozNodeArchitecture) => string | undefined;
  hotspotStatus?: (status: 'open' | 'resolved') => string;
}>;

/** Authored facts for the drag handle. The surface owns the frame and interactive controls. */
export function notationView<M>(
  h: Html.H<M>,
  node: ZlozNode,
  architecture: ZlozNodeArchitecture,
  labels: NativeNotationLabels | undefined,
) {
  const prefix = notationPrefix(architecture);
  const role = architectureRoleLabel(architecture);
  const external = architecture.family === 'c4' && architecture.scope === 'external';
  const roleText = external ? `${role} · external` : role;
  const technology = 'technology' in architecture ? architecture.technology : undefined;
  const subdomain = 'subdomain' in architecture ? architecture.subdomain : undefined;
  const hotspot =
    architecture.family === 'event-storming' && architecture.role === 'hotspot'
      ? architecture.status
      : undefined;
  const subdomainText = subdomain
    ? `${subdomain.charAt(0).toUpperCase()}${subdomain.slice(1)} subdomain`
    : undefined;
  const badge = labels?.badge?.(architecture);
  const statusText = hotspot
    ? (labels?.hotspotStatus?.(hotspot) ?? (hotspot === 'open' ? 'Open question' : 'Resolved'))
    : undefined;
  const authoredDescription =
    !node.kind || architecture.family === 'c4' ? architecture.description : undefined;
  const accessibleDescription = [
    roleText,
    badge,
    technology,
    subdomainText,
    statusText,
    authoredDescription,
  ]
    .filter(Boolean)
    .join('. ');
  const content = h.span
    .class('zloz-ui-notation', `${prefix}-body`)
    .attr(`data-${prefix}-body`, node.id)
    .children(
      architecture.family === 'c4' && architecture.role === 'person' && !node.kind
        ? person<M>()
        : null,
      badge ? h.span.class('zloz-ui-notation-badge').children(badge) : null,
      h.span
        .class(`${prefix}-type`)
        .attr(`data-${prefix}-type`, architecture.role)
        .children(roleText),
      h.strong.class(`${prefix}-name`).children(node.label),
      technology ? h.span.class('flow-c4-technology').children(technology) : null,
      subdomainText ? h.span.class('flow-ddd-subdomain').children(subdomainText) : null,
      statusText
        ? h.span
            .class('zloz-ui-hotspot-status')
            .attr('data-zloz-hotspot-status', hotspot)
            .style({ color: notationStroke(architecture) })
            .children(statusText)
        : null,
      authoredDescription
        ? h.span.class(`${prefix}-description`).children(authoredDescription)
        : null,
    );
  return { content, accessibleDescription };
}
