import type { ZlozTheme } from '@opsydyn/foldkit-zloz/effect-ui';

/** Values follow the document's personal palette. No graph/editor state is retained. */
export const teamCanvasTheme: ZlozTheme = {
  tokens: {
    background: 'transparent',
    canvasBorder: 'var(--rule)',
    gridDot: 'transparent',
    gridLine: 'transparent',
    nodeBackground: 'var(--panel)',
    nodeColor: 'var(--ink)',
    nodeBorder: 'var(--muted)',
    nodeRadius: '2px',
    groupBackground: 'color-mix(in srgb, var(--accent) 7%, transparent)',
    edge: 'var(--edge)',
    selection: 'var(--accent)',
    selectionBackground: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    inputPort: 'var(--input-port)',
    outputPort: 'var(--output-port)',
    portBorder: 'var(--panel)',
    controlColor: 'var(--control-ink)',
    validTarget: 'var(--input-port)',
    invalidTarget: 'var(--danger)',
    alignmentGuide: 'var(--ddd)',
    resizeBackground: 'var(--ink)',
    resizeReadoutBackground: 'var(--panel)',
    resizeReadoutColor: 'var(--ink)',
  },
};
