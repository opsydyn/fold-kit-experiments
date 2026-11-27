import type { ZlozNodeArchitecture } from '@opsydyn/foldkit-zloz';

export function workbenchArchitectureBadge(architecture: ZlozNodeArchitecture) {
  return architecture.family === 'ddd' && architecture.role === 'aggregate-root'
    ? 'Consistency owner'
    : undefined;
}

export function workbenchHotspotStatus(status: 'open' | 'resolved') {
  return status === 'open' ? 'Discuss · open' : 'Agreed · resolved';
}
