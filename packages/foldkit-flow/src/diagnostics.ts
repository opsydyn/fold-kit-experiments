export type FlowDiagnostics = Readonly<{
  measurements: boolean;
  alignmentGuides: boolean;
  zoomLevel: boolean;
  status: boolean;
  instructions: boolean;
  overview: boolean;
  connectionList: boolean;
}>;
export type FlowDiagnosticOptions = Readonly<{
  /** Hide all diagnostic presentation, regardless of individual flags. */
  minimalMode?: boolean;
  /** Globally enable/disable diagnostics, or override individual defaults. */
  diagnostics?: boolean | Partial<FlowDiagnostics>;
}>;

export function resolveFlowDiagnostics(options: FlowDiagnosticOptions): FlowDiagnostics {
  const enabled = options.minimalMode !== true && options.diagnostics !== false;
  const flags: Partial<FlowDiagnostics> =
    options.diagnostics === undefined ||
    options.diagnostics === true ||
    options.diagnostics === false
      ? {}
      : options.diagnostics;
  return {
    measurements: enabled && (flags.measurements ?? true),
    alignmentGuides: enabled && (flags.alignmentGuides ?? true),
    zoomLevel: enabled && (flags.zoomLevel ?? true),
    status: enabled && (flags.status ?? true),
    instructions: enabled && (flags.instructions ?? true),
    overview: enabled && (flags.overview ?? true),
    connectionList: enabled && (flags.connectionList ?? true),
  };
}

/** Keep descriptions and announcements available without reserving visible space. */
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  'white-space': 'nowrap',
  border: '0',
} as const;
