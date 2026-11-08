import {
  zlozDarkTheme,
  zlozLightTheme,
  type ZlozColorScheme,
  type ZlozTheme,
} from '@opsydyn/foldkit-zloz/foldkit';

export const themePreferenceStorageKey = 'opsydyn.foldkit-flow.color-scheme.v1';

/** The same neutral/blue family palette as Viz and Three; graph state stays headless. */
const familyTokens = {
  background: 'var(--paper)',
  canvasBorder: 'var(--rule)',
  gridLine: 'var(--rule)',
  gridDot: 'var(--rule)',
  nodeBackground: 'var(--panel)',
  nodeColor: 'var(--ink)',
  nodeBorder: 'var(--muted)',
  nodeRadius: '8px',
  groupBackground: 'color-mix(in srgb, var(--blue) 8%, transparent)',
  edge: 'var(--muted)',
  selection: 'var(--blue)',
  selectionBackground: 'color-mix(in srgb, var(--blue) 12%, transparent)',
  outputPort: 'var(--blue)',
  inputPort: 'var(--coral)',
  validTarget: 'var(--blue)',
  invalidTarget: 'var(--coral)',
  alignmentGuide: 'var(--coral)',
  portBorder: 'var(--panel)',
  controlColor: 'var(--panel)',
  resizeBackground: 'var(--muted)',
  resizeReadoutBackground: 'var(--panel)',
  resizeReadoutColor: 'var(--ink)',
} as const;

export const workbenchThemes = {
  light: { ...zlozLightTheme, tokens: { ...zlozLightTheme.tokens, ...familyTokens } },
  dark: { ...zlozDarkTheme, tokens: { ...zlozDarkTheme.tokens, ...familyTokens } },
} satisfies Record<ZlozColorScheme, ZlozTheme>;
