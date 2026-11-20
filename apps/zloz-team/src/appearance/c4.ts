import type { C4NodeArchitecture } from '@opsydyn/foldkit-zloz';

/** The canvas and the SVG renderer use the same C4 meaning. */
export function c4Appearance(architecture: C4NodeArchitecture) {
  const externalSystem =
    architecture.role === 'software-system' && architecture.scope === 'external';
  const icon =
    architecture.role === 'person'
      ? 'user'
      : architecture.scope === 'external'
        ? 'cloud'
        : architecture.role === 'container'
          ? 'stack'
          : architecture.role === 'component'
            ? 'cube'
            : 'package';
  const type = externalSystem ? 'external system' : architecture.role.replaceAll('-', ' ');
  return { icon, label: `C4 · ${type}` } as const;
}
