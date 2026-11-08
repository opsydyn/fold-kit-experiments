const tokenProperties = {
  background: '--flow-background',
  canvasBorder: '--flow-canvas-border',
  gridLine: '--flow-grid-line',
  gridDot: '--flow-grid-dot',
  nodeBackground: '--flow-node-background',
  nodeColor: '--flow-node-color',
  nodeBorder: '--flow-node-border',
  nodeRadius: '--flow-node-radius',
  groupBackground: '--flow-group-background',
  inputPort: '--flow-input-port',
  outputPort: '--flow-output-port',
  portBorder: '--flow-port-border',
  controlColor: '--flow-control-color',
  edge: '--flow-edge',
  edgeWidth: '--flow-edge-width',
  selection: '--flow-selection',
  selectionBackground: '--flow-selection-background',
  validTarget: '--flow-valid-target',
  invalidTarget: '--flow-invalid-target',
  alignmentGuide: '--flow-alignment-guide',
  resizeBackground: '--flow-resize-background',
  resizeReadoutBackground: '--flow-resize-readout-background',
  resizeReadoutColor: '--flow-resize-readout-color',
} as const;

export type ZlozThemeToken = keyof typeof tokenProperties;
export type ZlozThemeTokens = Readonly<Partial<Record<ZlozThemeToken, string>>>;
export type ZlozColorScheme = 'light' | 'dark';

/** Scoped token overrides. Missing tokens keep the inherited values and component fallbacks. */
export type ZlozTheme = Readonly<{
  /** Also sets the browser's scheme for native inputs and buttons inside this view. */
  colorScheme?: ZlozColorScheme;
  /** CSS values, including references to host or Pleat variables. */
  tokens?: ZlozThemeTokens;
}>;

/** Light palette for canvas, nodes, connections, and interaction feedback. */
export const zlozLightTheme = Object.freeze({
  colorScheme: 'light',
  tokens: Object.freeze({
    background: '#eef2f6',
    canvasBorder: '#94a3b8',
    gridLine: '#94a3b855',
    gridDot: '#94a3b855',
    nodeBackground: '#ffffff',
    nodeColor: '#172033',
    nodeBorder: '#64748b',
    nodeRadius: '8px',
    groupBackground: 'rgb(100 116 139 / 0.08)',
    inputPort: '#0f766e',
    outputPort: '#2563eb',
    portBorder: '#ffffff',
    controlColor: '#ffffff',
    edge: '#64748b',
    edgeWidth: '3',
    selection: '#2563eb',
    selectionBackground: 'rgb(37 99 235 / 0.12)',
    validTarget: '#0f766e',
    invalidTarget: '#dc2626',
    alignmentGuide: '#7c3aed',
    resizeBackground: '#334155',
    resizeReadoutBackground: '#ffffff',
    resizeReadoutColor: '#172033',
  } satisfies Required<ZlozThemeTokens>),
} satisfies ZlozTheme);

/** Dark palette with a light selection color and dark text on filled controls. */
export const zlozDarkTheme = Object.freeze({
  colorScheme: 'dark',
  tokens: Object.freeze({
    background: '#111827',
    canvasBorder: '#596780',
    gridLine: '#94a3b84d',
    gridDot: '#94a3b86b',
    nodeBackground: '#202b3e',
    nodeColor: '#edf2fa',
    nodeBorder: '#7889a3',
    nodeRadius: '8px',
    groupBackground: 'rgb(148 163 184 / 0.1)',
    inputPort: '#7bd8c9',
    outputPort: '#98beff',
    portBorder: '#1a2638',
    controlColor: '#101a2b',
    edge: '#a6b7ce',
    edgeWidth: '3',
    selection: '#98beff',
    selectionBackground: 'rgb(152 190 255 / 0.16)',
    validTarget: '#7bd8c9',
    invalidTarget: '#ff9ca5',
    alignmentGuide: '#c4a1ff',
    resizeBackground: '#a6b7ce',
    resizeReadoutBackground: '#202b3e',
    resizeReadoutColor: '#edf2fa',
  } satisfies Required<ZlozThemeTokens>),
} satisfies ZlozTheme);

type ZlozThemeStyle = {
  color: string;
  'color-scheme'?: ZlozColorScheme;
} & Partial<Record<(typeof tokenProperties)[ZlozThemeToken], string>>;

export function zlozThemeStyle(theme: ZlozTheme): ZlozThemeStyle {
  const style: ZlozThemeStyle = { color: 'var(--flow-node-color, inherit)' };
  if (theme.colorScheme !== undefined) style['color-scheme'] = theme.colorScheme;
  // SAFETY: tokenProperties is a module-local literal, so its own enumerable keys are ZlozThemeToken.
  for (const token of Object.keys(tokenProperties) as ZlozThemeToken[]) {
    const value = theme.tokens?.[token];
    if (value !== undefined) style[tokenProperties[token]] = value;
  }
  return style;
}
