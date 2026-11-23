import { assignVars, createGlobalThemeContract, globalStyle } from '@vanilla-extract/css';

const theme = createGlobalThemeContract({
  paper: 'team-paper',
  panel: 'team-panel',
  raised: 'team-raised',
  ink: 'team-ink',
  muted: 'team-muted',
  rule: 'team-rule',
  accent: 'team-accent',
  c4: 'team-c4',
  ddd: 'team-ddd',
  edge: 'team-edge',
  controlInk: 'team-control-ink',
  inputPort: 'team-input-port',
  outputPort: 'team-output-port',
  danger: 'team-danger',
  grid: 'team-grid',
  controlRule: 'team-control-rule',
});
const light = {
  paper: '#f4f5f1',
  panel: '#ffffff',
  raised: '#e7ece7',
  ink: '#192c28',
  muted: '#53655f',
  rule: '#b8c5bc',
  accent: '#24694f',
  c4: '#236b58',
  ddd: '#8a4a15',
  edge: '#63746e',
  controlInk: '#ffffff',
  inputPort: '#1b6b62',
  outputPort: '#285e99',
  danger: '#b33242',
  grid: '#b5c2b7',
  controlRule: '#7a8d84',
};
const dark: typeof light = {
  paper: '#0b1110',
  panel: '#141d1a',
  raised: '#1d2b25',
  ink: '#e7eee8',
  muted: '#a0b4a9',
  rule: '#344a40',
  accent: '#92d6b4',
  c4: '#89c3c5',
  ddd: '#e9b76e',
  edge: '#a5b7b0',
  controlInk: '#0d1b16',
  inputPort: '#8ed9c8',
  outputPort: '#9cbcf9',
  danger: '#ff9aab',
  grid: '#344a40',
  controlRule: '#688177',
};
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const cut = 'polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)';
globalStyle(':root', {
  vars: {
    ...assignVars(theme, light),
    '--paper': theme.paper,
    '--panel': theme.panel,
    '--raised': theme.raised,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--rule': theme.rule,
    '--accent': theme.accent,
    '--c4': theme.c4,
    '--ddd': theme.ddd,
    '--edge': theme.edge,
    '--control-ink': theme.controlInk,
    '--input-port': theme.inputPort,
    '--output-port': theme.outputPort,
    '--danger': theme.danger,
  },
  colorScheme: 'light',
  fontFamily: 'system-ui, sans-serif',
});
globalStyle(
  ':root[data-team-theme="dark"]:not(:has([data-team-theme-preference])), :root:has([data-team-theme-preference="dark"])',
  {
    vars: assignVars(theme, dark),
    colorScheme: 'dark',
  },
);
globalStyle(
  ':root[data-team-theme="system"]:not(:has([data-team-theme-preference])), :root:has([data-team-theme-preference="system"])',
  {
    '@media': {
      '(prefers-color-scheme: dark)': { vars: assignVars(theme, dark), colorScheme: 'dark' },
    },
  },
);
globalStyle('*', { boxSizing: 'border-box' });
globalStyle('html, body', {
  margin: 0,
  minHeight: '100%',
  background: theme.paper,
  color: theme.ink,
});
globalStyle('body', { fontSize: 15, lineHeight: 1.55 });
globalStyle('a', { color: theme.accent, textUnderlineOffset: 4 });
globalStyle('button, input, select, textarea', {
  font: 'inherit',
  color: theme.ink,
  maxWidth: '100%',
});
globalStyle('button, .button-link', {
  minHeight: 44,
  padding: '10px 15px',
  border: `1px solid ${theme.controlRule}`,
  borderRadius: 2,
  background: theme.panel,
  color: theme.ink,
  fontFamily: mono,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.015em',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
});
globalStyle(
  'button:hover:not(:disabled):where(:not([data-flow-port], [data-flow-handle], [data-flow-resize])), .button-link:hover',
  {
    background: theme.raised,
    borderColor: theme.accent,
  },
);
globalStyle('button:disabled', { opacity: 0.48, cursor: 'not-allowed' });
globalStyle(
  'a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex="0"]:focus-visible',
  { outline: `3px solid ${theme.accent}`, outlineOffset: 3 },
);
globalStyle('input, select, textarea', {
  width: '100%',
  minWidth: 0,
  padding: '10px 12px',
  background: theme.paper,
  border: `1px solid ${theme.controlRule}`,
  borderRadius: 2,
});
globalStyle('label', { display: 'grid', gap: 7, minWidth: 0, color: theme.muted, fontSize: 13 });
globalStyle('p', { color: theme.muted });
globalStyle('h1', {
  fontSize: 'clamp(26px, 3vw, 40px)',
  letterSpacing: '-.035em',
  lineHeight: 1.16,
  overflowWrap: 'anywhere',
  margin: '16px 0 20px',
});
globalStyle('h2', { fontSize: 20, lineHeight: 1.3 });
globalStyle('section', { marginTop: 32, paddingTop: 20, borderTop: `1px solid ${theme.rule}` });
globalStyle('.site-header', {
  minHeight: 84,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 20,
  padding: '16px 32px',
  borderBottom: `1px solid ${theme.rule}`,
  background: theme.panel,
});
globalStyle('.brand', {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  color: theme.ink,
  textDecoration: 'none',
});
globalStyle('.brand-mark', {
  width: 36,
  height: 36,
  flexShrink: 0,
});
globalStyle('.brand-mark svg', {
  display: 'block',
  width: '100%',
  height: '100%',
});
globalStyle('.brand strong', {
  fontFamily: mono,
  fontSize: 16,
  fontWeight: 700,
});
globalStyle('.brand small', {
  display: 'block',
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: '.13em',
  textTransform: 'uppercase',
  color: theme.muted,
});
globalStyle('.theme-controls', {
  display: 'flex',
  gap: 2,
  border: `1px solid ${theme.rule}`,
  padding: 3,
  background: theme.paper,
});
globalStyle('.theme-controls button', {
  padding: '8px 10px',
  minHeight: 36,
  fontSize: 11,
  borderColor: 'transparent',
  background: 'transparent',
});
globalStyle('.theme-controls button[aria-pressed="true"]', {
  background: theme.panel,
  borderColor: theme.accent,
  color: theme.accent,
});
globalStyle('.theme-notice', {
  display: 'block',
  color: theme.muted,
  fontSize: 11,
  maxWidth: 280,
  marginTop: 6,
});
globalStyle('.page-content', { maxWidth: 720, margin: '9vh auto', padding: '0 28px 64px' });
globalStyle('.page-content.wide', { maxWidth: 1160, marginTop: 36 });
globalStyle('.board-page', {
  height: '100dvh',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
});
globalStyle('.board-page .site-header', {
  minHeight: 0,
  padding: '8px 16px',
  gap: 14,
});
globalStyle('.board-page .brand small', { display: 'none' });
globalStyle('.board-page .brand-mark', { width: 26, height: 26 });
globalStyle('.board-title', { flex: '1 1 0', minWidth: 0 });
globalStyle('.board-title h1', {
  fontSize: 'clamp(15px, 2vw, 23px)',
  margin: '2px 0 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
globalStyle('.board-content, .board-content astro-island', { minWidth: 0, minHeight: 0 });
globalStyle('.board-content', { display: 'grid', gridTemplateRows: 'minmax(0, 1fr)' });
globalStyle('.board-page .site-header', {
  '@media': {
    '(max-width: 680px)': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      padding: '6px 10px',
      gap: '6px 10px',
    },
  },
});
globalStyle('.board-page .brand strong', {
  '@media': { '(max-width: 680px)': { fontSize: 14 } },
});
globalStyle('.board-title', {
  '@media': { '(max-width: 680px)': { gridRow: 2, gridColumn: '1 / -1' } },
});
globalStyle('nav[aria-label="Diagram"], nav[aria-label="Workspace"]', {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 20,
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: '.035em',
});
globalStyle('.invite-form, .member-form', {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 14,
  alignItems: 'end',
});
globalStyle('.invite-form label, .member-form label', { flex: '1 1 220px' });
globalStyle('.entries', { listStyle: 'none', margin: 0, padding: 0 });
globalStyle('.entries li', {
  padding: '16px 0 24px',
  borderBottom: `1px solid ${theme.rule}`,
  overflowWrap: 'anywhere',
});
globalStyle('.entries form', { marginTop: 16 });
globalStyle('.error, [role="alert"]', {
  padding: '10px 14px',
  borderLeft: `3px solid ${theme.danger}`,
  color: theme.ink,
  background: `color-mix(in srgb, ${theme.danger} 6%, ${theme.panel})`,
});
globalStyle('.shared-editor', {
  vars: { '--emphasis': theme.c4, '--tools-width': '0px', '--inspector-width': '0px' },
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateColumns: 'var(--tools-width) minmax(0, 1fr) var(--inspector-width)',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gridTemplateAreas: '"toolbar toolbar toolbar" "tools canvas inspector"',
  '@media': {
    '(max-width: 1080px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateAreas: '"toolbar" "canvas"',
    },
  },
});
globalStyle('.shared-editor[data-tools-open="true"]', { vars: { '--tools-width': '190px' } });
globalStyle('.shared-editor[data-inspector-open="true"]', {
  vars: { '--inspector-width': '290px' },
});
globalStyle('.shared-editor[data-inspector-open="true"][data-inspector-mode="coupling"]', {
  vars: { '--inspector-width': '420px' },
});
globalStyle('.shared-editor[data-canvas-emphasis="ddd"]', { vars: { '--emphasis': theme.ddd } });
globalStyle('.shared-editor[data-canvas-emphasis="neutral"]', {
  vars: { '--emphasis': theme.muted },
});
globalStyle('.tool-rail, .editor-inspector', {
  margin: 0,
  padding: 16,
  background: theme.panel,
  border: `1px solid ${theme.rule}`,
  minWidth: 0,
  minHeight: 0,
  '@media': {
    '(max-width: 1080px)': {
      zIndex: 3,
      position: 'absolute',
      gridArea: 'canvas',
      top: 0,
      bottom: 0,
      width: 'min(86vw, 330px)',
      boxShadow: '0 8px 28px #0005',
    },
  },
});
globalStyle('.tool-rail[hidden], .editor-inspector[hidden]', { display: 'none' });
globalStyle('.tool-rail', {
  gridArea: 'tools',
  overflowY: 'auto',
  '@media': { '(max-width: 1080px)': { gridArea: 'canvas', left: 0, width: 'min(86vw, 240px)' } },
});
globalStyle('.editor-inspector', {
  gridArea: 'inspector',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  paddingBottom: 0,
  '@media': { '(max-width: 1080px)': { gridArea: 'canvas', right: 0 } },
});
globalStyle('[data-inspector-mode="coupling"] .editor-inspector', {
  '@media': { '(max-width: 1080px)': { width: 'min(100%, 420px)' } },
});
globalStyle('.shared-editor[data-inspector-open="true"][data-inspector-mode="evolution"]', {
  vars: { '--inspector-width': '390px' },
});
globalStyle('.shared-editor[data-inspector-mode="evolution"] .editor-inspector', {
  '@media': { '(max-width: 1080px)': { width: 'min(100%, 390px)' } },
});
globalStyle('.board-evolution', { margin: 0, border: 0, padding: '8px 0', fontSize: 13 });
globalStyle('.board-evolution .evolution-window', { fontWeight: 600, color: theme.ink });
globalStyle('.board-evolution .chart-frame', { height: 'auto' });
globalStyle('.board-evolution .chart-data-table', {
  width: '100%',
  marginTop: 12,
  borderCollapse: 'collapse',
  textAlign: 'left',
});
globalStyle('.board-evolution .chart-data-table caption', {
  marginBottom: 6,
  fontWeight: 600,
  textAlign: 'left',
});
globalStyle('.board-evolution .chart-data-table th, .board-evolution .chart-data-table td', {
  padding: '3px 6px',
  borderBottom: `1px solid ${theme.rule}`,
});
globalStyle('.inspector-content', {
  minHeight: 0,
  minWidth: 0,
  margin: '0 -12px',
  padding: '4px 12px 16px',
  overflow: 'auto',
  overscrollBehavior: 'contain',
});
globalStyle('.inspector-primary', {
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  background: theme.panel,
});
globalStyle('.inspector-content button.inspector-primary', {
  background: theme.panel,
  borderColor: theme.accent,
});
globalStyle('.rail-heading', {
  margin: '0 0 14px',
  fontFamily: mono,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: theme.muted,
});
globalStyle('.editor-actions', { display: 'grid', gap: 8 });
globalStyle('.editor-actions button', {
  justifyContent: 'flex-start',
  width: '100%',
  textAlign: 'left',
  whiteSpace: 'normal',
});
globalStyle('.editor-actions button:first-child', {
  background: theme.accent,
  color: theme.controlInk,
  borderColor: theme.accent,
});
globalStyle('.tool-divider', { height: 1, background: theme.rule, margin: '18px 0' });
globalStyle('.canvas-mode', { marginTop: 18 });
globalStyle('.canvas-mode select', {
  fontFamily: mono,
  fontSize: 12,
  borderColor: 'var(--emphasis)',
});
globalStyle('.mode-note', { fontSize: 11, lineHeight: 1.5, margin: '10px 0 0' });
globalStyle('.role-label', {
  fontFamily: mono,
  textTransform: 'uppercase',
  fontSize: 10,
  letterSpacing: '.08em',
  color: theme.muted,
  paddingTop: 16,
  borderTop: `1px solid ${theme.rule}`,
  marginTop: 18,
});
globalStyle('.canvas-column', {
  gridArea: 'canvas',
  minWidth: 0,
  minHeight: 0,
  position: 'relative',
});
globalStyle('.canvas-toolbar', {
  gridArea: 'toolbar',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '4px 12px',
  padding: '4px 8px',
  border: `1px solid ${theme.rule}`,
  background: theme.panel,
});
globalStyle('.board-controls, .board-session, .board-navigation', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
});
globalStyle('.board-controls button, .board-session button, .board-navigation button', {
  minHeight: 36,
  padding: '5px 8px',
  fontSize: 11,
});
globalStyle(
  '.board-controls button[aria-expanded="true"], #board-overview-toggle[aria-expanded="true"]',
  {
    color: theme.accent,
    borderColor: theme.accent,
  },
);
globalStyle('.board-session', { gap: 10 });
globalStyle('.board-canvas', {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  flex: '1 1 0',
});
globalStyle('.board-navigation', {
  position: 'relative',
  padding: '3px 8px',
  background: theme.panel,
  borderTop: `1px solid ${theme.rule}`,
});
globalStyle('.board-canvas > [data-flow-status]', {
  padding: '0 8px',
  fontSize: 11,
  color: theme.muted,
  background: theme.panel,
});
globalStyle('.board-popover summary', {
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 8px',
  border: `1px solid ${theme.rule}`,
  background: theme.panel,
  fontFamily: mono,
  fontSize: 11,
  cursor: 'pointer',
});
globalStyle('.board-popover summary::before', { content: '"▸"', color: theme.accent });
globalStyle('.board-popover[open] summary::before', { content: '"▾"' });
globalStyle('.board-popover summary:focus-visible', {
  outline: `2px solid ${theme.accent}`,
  outlineOffset: 2,
});
globalStyle('.board-popover-content', {
  position: 'absolute',
  zIndex: 2,
  insetInlineStart: 8,
  bottom: 'calc(100% + 4px)',
  width: 'min(calc(100% - 16px), 440px)',
  maxHeight: 'min(35dvh, 280px)',
  overflow: 'auto',
  overscrollBehavior: 'contain',
  padding: 12,
  background: theme.panel,
  border: `1px solid ${theme.rule}`,
  boxShadow: '0 8px 28px #0005',
});
globalStyle('.board-popover-content .shared-connections', { marginTop: 0 });
globalStyle('.board-popover-content.board-overview', {
  insetInlineStart: 'auto',
  insetInlineEnd: 8,
  width: 'min(calc(100% - 16px), 248px)',
  padding: 8,
});
globalStyle('.board-presence', { position: 'relative' });
globalStyle('.board-presence .board-popover-content', {
  zIndex: 5,
  top: '100%',
  bottom: 'auto',
  right: 0,
  left: 'auto',
  width: 'min(75vw, 265px)',
});
globalStyle('.board-skip:not(:focus)', {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
});
globalStyle('.board-find', {
  position: 'absolute',
  gridColumn: '1 / -1',
  gridRow: '2 / 3',
  top: 6,
  zIndex: 4,
  justifySelf: 'center',
  width: 'min(calc(100% - 16px), 500px)',
  maxHeight: 'calc(100% - 12px)',
  overflow: 'auto',
  overscrollBehavior: 'contain',
  padding: 12,
  background: theme.panel,
  border: `1px solid ${theme.controlRule}`,
  boxShadow: '0 8px 28px #0005',
});
globalStyle('.board-find > p', { margin: '8px 0', fontSize: 12 });
globalStyle('.mermaid-launcher, .svg-launcher, .layout-launcher', { width: '100%', marginTop: 8 });
globalStyle('.board-layout-preview', {
  position: 'absolute',
  zIndex: 2,
  top: 8,
  right: 8,
  width: 'min(100% - 16px, 310px)',
  padding: 10,
  background: theme.panel,
  border: `1px solid ${theme.controlRule}`,
  boxShadow: '0 8px 28px #0005',
});
globalStyle('.board-layout-preview p', { margin: '0 0 8px', fontSize: 13 });
globalStyle('.layout-preview-actions', { display: 'flex', flexWrap: 'wrap', gap: 8 });
globalStyle('.layout-ghost', {
  padding: 8,
  color: theme.ink,
  border: `2px dashed ${theme.accent}`,
  background: `color-mix(in srgb, ${theme.panel} 70%, ${theme.accent} 30%)`,
  fontFamily: mono,
  fontSize: 12,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
});
globalStyle('.layout-ghost-group', {
  background: `color-mix(in srgb, transparent 84%, ${theme.accent})`,
});
globalStyle('.board-mermaid, .board-svg', {
  position: 'absolute',
  gridColumn: '1 / -1',
  gridRow: '2 / 3',
  top: 6,
  zIndex: 4,
  justifySelf: 'center',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  width: 'min(calc(100% - 16px), 660px)',
  height: 'min(570px, calc(100% - 12px))',
  background: theme.panel,
  border: `1px solid ${theme.controlRule}`,
  boxShadow: '0 8px 28px #0005',
});
globalStyle('.board-svg', { gridTemplateRows: 'auto minmax(0, 1fr)' });
globalStyle('.svg-review', { minHeight: 0, gridTemplateRows: 'minmax(0, 1fr) auto' });
globalStyle('.svg-review-settings', {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  margin: '8px 0 12px',
});
globalStyle('.svg-review-footer', {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
});
globalStyle('.svg-review-footer p', { flexBasis: '100%' });
globalStyle('.svg-review-footer label', { display: 'flex', alignItems: 'center' });
globalStyle('.svg-review-footer input', { width: 'auto' });
globalStyle('.mermaid-review-header, .mermaid-review-footer', {
  padding: '10px 14px',
  background: theme.raised,
});
globalStyle('.mermaid-review-header', {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  borderBottom: `1px solid ${theme.rule}`,
});
globalStyle('.mermaid-review-header h2, .mermaid-review-header p, .mermaid-review-footer p', {
  margin: 0,
});
globalStyle('.mermaid-review-body', {
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: '2px 14px 12px',
  overflowWrap: 'anywhere',
});
globalStyle('.mermaid-review-body pre', {
  padding: 12,
  background: theme.paper,
  border: `1px solid ${theme.rule}`,
  whiteSpace: 'pre-wrap',
  fontSize: 12,
});
globalStyle('.mermaid-review-footer', { borderTop: `1px solid ${theme.rule}` });
globalStyle('.mermaid-consent, .mermaid-download-actions', {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});
globalStyle('.mermaid-consent input', { width: 'auto' });
globalStyle('.mermaid-download-actions', { flexWrap: 'wrap', marginTop: 6 });
globalStyle('.find-controls', {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'end',
  gap: 8,
});
globalStyle('.find-results', {
  padding: 0,
  margin: 0,
  listStyle: 'none',
  display: 'grid',
  gap: 4,
});
globalStyle('.find-results button', { width: '100%', textAlign: 'left', overflowWrap: 'anywhere' });
globalStyle('.mode-badge', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--emphasis)',
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  fontWeight: 700,
});
globalStyle('[data-save-status]', {
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
});
globalStyle('[data-save-status]::before', {
  content: '""',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: theme.accent,
});
globalStyle(
  '[data-save-status="Move conflict"]::before, [data-save-status="Move rejected"]::before',
  {
    background: theme.danger,
  },
);
globalStyle('.canvas-alerts:not(:empty)', {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 1,
  maxWidth: 'calc(100% - 16px)',
  padding: '0 8px',
  fontSize: 13,
  background: theme.panel,
  border: `1px solid ${theme.rule}`,
});
globalStyle('.canvas-alerts p', { margin: '4px 0' });
globalStyle('.shared-editor [data-flow-surface]', {
  backgroundImage: `radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--emphasis) 13%, transparent), transparent 70%), linear-gradient(color-mix(in srgb, ${theme.grid} 45%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${theme.grid} 45%, transparent) 1px, transparent 1px)`,
  backgroundSize: '100% 100%, 24px 24px, 24px 24px',
});
globalStyle('.shared-editor [data-flow-help]', {
  fontSize: 11,
  color: theme.muted,
});
globalStyle('.shared-editor .shared-node', {
  position: 'static',
  width: '100%',
  padding: 12,
  border: `2px solid ${theme.rule}`,
  borderRadius: 2,
  background: theme.panel,
  overflow: 'visible',
});
globalStyle('.shared-editor .shared-node[data-architecture="c4"]', { borderColor: theme.c4 });
globalStyle('.shared-editor .shared-node[data-architecture="ddd"]', { borderColor: theme.ddd });
globalStyle('.shared-editor .shared-node.is-selected', {
  borderColor: theme.accent,
  boxShadow: `0 0 0 1px ${theme.accent}`,
});
globalStyle('.shared-node-frame', {
  position: 'absolute',
  boxSizing: 'border-box',
  border: 0,
  padding: 0,
  margin: 0,
  pointerEvents: 'auto',
});
globalStyle('.shared-editor .shared-node-title', {
  width: '100%',
  height: '100%',
  padding: 0,
  background: 'transparent',
  color: theme.ink,
  border: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: 5,
  touchAction: 'none',
  overflowWrap: 'anywhere',
  fontFamily: mono,
  fontSize: 13,
  lineHeight: 1.3,
  letterSpacing: '.02em',
});
globalStyle('.node-name', { display: 'flex', alignItems: 'center', gap: 10, width: '100%' });
globalStyle('.node-name .team-icon', { flexShrink: 0, color: theme.accent });
globalStyle('.node-type', {
  color: theme.muted,
  fontSize: 9,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  paddingLeft: 30,
});
globalStyle('.team-icon', { display: 'block', flexShrink: 0 });
globalStyle('.shared-editor .shared-node-resize', {
  position: 'absolute',
  right: -8,
  bottom: -8,
  border: 'none',
  padding: 0,
  width: 24,
  height: 24,
  minHeight: 24,
  display: 'grid',
  placeItems: 'center',
  cursor: 'ew-resize',
  userSelect: 'none',
  color: theme.panel,
  background: theme.ink,
  borderRadius: 3,
});
globalStyle('.shared-editor .shared-node-port', {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  right: 'auto',
  bottom: 'auto',
  pointerEvents: 'auto',
  zIndex: 1,
  width: 24,
  height: 24,
  minHeight: 24,
  padding: 0,
  borderRadius: '50%',
  border: `2px solid ${theme.panel}`,
  boxShadow: 'none',
  color: theme.controlInk,
  cursor: 'crosshair',
  background: theme.inputPort,
});
globalStyle('.shared-editor .shared-node-port[data-flow-port-kind="output"]', {
  background: theme.outputPort,
});
globalStyle('.shared-editor .shared-node-port.is-target', {
  border: `3px solid ${theme.ink}`,
  boxShadow: `0 0 0 3px ${theme.inputPort}`,
});
globalStyle('.shared-connections', { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 });
globalStyle('.shared-editor .shared-connection', {
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  padding: '6px 9px',
  minHeight: 32,
  fontSize: 10,
});
globalStyle('.editor-inspector input', { marginBottom: 10 });
globalStyle('.editor-inspector button', { width: '100%', marginBottom: 8 });
globalStyle('.inspector-hint', { fontSize: 12, marginBottom: 24 });
globalStyle('.inspector-mode', { marginBottom: 8 });
globalStyle('.coupling-map', { fontSize: 13, overflowWrap: 'anywhere', minWidth: 0 });
globalStyle('.coupling-map h2', { fontFamily: mono, fontSize: 16, lineHeight: 1.5 });
globalStyle('.coupling-map h3', { fontFamily: mono, fontSize: 12, margin: '20px 0 8px' });
globalStyle('.coupling-map p', { margin: '8px 0' });
globalStyle('.coupling-readiness', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 });
globalStyle('.coupling-readiness div', {
  padding: 8,
  border: `1px solid ${theme.rule}`,
  background: theme.raised,
});
globalStyle('.coupling-readiness dt', { fontSize: 11, color: theme.muted });
globalStyle('.coupling-readiness dd', {
  margin: 0,
  fontFamily: mono,
  fontSize: 18,
  color: theme.ink,
});
globalStyle('.coupling-measure', { width: '100%', minWidth: 0 });
globalStyle('.coupling-orbit .chart-orbit-halo', { fillOpacity: 0.85, strokeOpacity: 1 });
globalStyle('.coupling-orbit', { width: 300, maxWidth: '100%', margin: '20px auto 12px' });
globalStyle('.coupling-orbit figcaption', { fontSize: 12, color: theme.muted, marginTop: 12 });
globalStyle('.coupling-orbit .chart-orbit-mark:focus-visible', {
  outline: `2px solid ${theme.accent}`,
  outlineOffset: 3,
});
globalStyle('.coupling-legend', {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  padding: 0,
  listStyle: 'none',
  gap: 8,
});
globalStyle('.coupling-category', { marginRight: 6 });
globalStyle('.coupling-note', { fontSize: 12 });
globalStyle('.coupling-table', {
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  marginTop: 20,
});
globalStyle('.coupling-table caption', {
  textAlign: 'left',
  color: theme.muted,
  paddingBottom: 10,
});
globalStyle('.coupling-table th, .coupling-table td', {
  borderTop: `1px solid ${theme.rule}`,
  padding: '12px 6px',
  textAlign: 'left',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
});
globalStyle('.coupling-table th:first-child', { width: '40%' });
globalStyle('.coupling-table tbody th', { fontWeight: 400 });
globalStyle('.coupling-map button', {
  minHeight: 44,
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  fontSize: 12,
});
globalStyle('.coupling-table button', {
  padding: '8px 6px',
  background: theme.panel,
  color: theme.ink,
  border: `1px solid ${theme.controlRule}`,
});
globalStyle('.coupling-outcome', { fontWeight: 650, color: theme.ink });
globalStyle('.coupling-evidence summary', {
  cursor: 'pointer',
  minHeight: 44,
  padding: '10px 0',
  color: theme.accent,
});
globalStyle('.coupling-evidence dt', {
  fontWeight: 650,
  color: theme.ink,
  textTransform: 'capitalize',
});
globalStyle('.coupling-evidence dd', { margin: '0 0 10px', color: theme.muted });
globalStyle('.coupling-pages', {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  marginTop: 12,
});
globalStyle('.coupling-notice', {
  background: theme.raised,
  border: `1px solid ${theme.rule}`,
  padding: 12,
  overflowWrap: 'anywhere',
});
globalStyle('.coupling-announcement', { minHeight: '1.55em', color: theme.ink });
globalStyle('.board-facts', {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  marginTop: 20,
  paddingTop: 18,
  borderTop: `1px solid ${theme.rule}`,
});
globalStyle('.board-facts div', { border: `1px solid ${theme.rule}`, padding: 10 });
globalStyle('.board-facts strong', { display: 'block', fontFamily: mono, fontSize: 20 });
globalStyle('.board-facts span', {
  fontFamily: mono,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  color: theme.muted,
});
globalStyle('.presence', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: theme.muted,
});
globalStyle('.presence span', {
  border: `1px solid ${theme.rule}`,
  padding: '4px 8px',
  background: theme.panel,
});
globalStyle('.peer-cursor', {
  color: theme.ink,
  background: theme.panel,
  padding: '2px 6px',
  border: `1px solid ${theme.accent}`,
  fontSize: 11,
});
globalStyle('.shared-group', {
  border: `2px dashed ${theme.muted}`,
  background: `color-mix(in srgb, ${theme.accent} 7%, ${theme.panel})`,
});
globalStyle('.shared-group-title', { padding: '4px 8px' });
globalStyle('.secondary', { color: theme.accent, background: theme.panel });
globalStyle('.site-header', {
  '@media': { '(max-width: 680px)': { padding: '12px 16px', gap: 10, flexWrap: 'wrap' } },
});
globalStyle('.page-content', {
  '@media': { '(max-width: 680px)': { paddingLeft: 16, paddingRight: 16, marginTop: 24 } },
});
globalStyle('.invite-form button, .member-form button', {
  '@media': { '(max-width: 600px)': { width: '100%' } },
});
globalStyle('*', { '@media': { '(prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' } } });

globalStyle('.theme-controls button', { '@media': { '(max-width: 680px)': { minHeight: 44 } } });

globalStyle('.coupling-authoring', {
  borderTop: `1px solid ${theme.rule}`,
  marginTop: 20,
  paddingTop: 16,
  overflowWrap: 'anywhere',
});
globalStyle('.coupling-authoring fieldset', {
  minWidth: 0,
  border: `1px solid ${theme.rule}`,
  padding: 10,
  margin: '12px 0',
});
globalStyle('.coupling-authoring label', { display: 'grid', gap: 6, marginBottom: 10 });
globalStyle('.coupling-authoring textarea, .coupling-authoring select', {
  width: '100%',
  boxSizing: 'border-box',
  minWidth: 0,
});
globalStyle('.coupling-authoring textarea', { minHeight: 72, resize: 'vertical' });
globalStyle('.coupling-authoring p', { fontSize: 12, lineHeight: 1.55 });

globalStyle('.zloz-aggregate-view', { overflowWrap: 'anywhere', fontSize: 13 });
globalStyle('.zloz-aggregate-view h2', { fontFamily: mono, fontSize: 16 });
globalStyle('.zloz-aggregate-view h3', { fontSize: 13, margin: '20px 0 6px' });
globalStyle('.zloz-aggregate-view ul', { paddingInlineStart: 20 });

globalStyle('.opy-launcher', { width: '100%', marginBottom: 8, color: theme.outputPort });
globalStyle('.opy-inspector', {
  display: 'grid',
  minWidth: 0,
  gap: 10,
  marginTop: 10,
  padding: 12,
  clipPath: cut,
  border: `1px solid ${theme.rule}`,
  background: theme.paper,
});
globalStyle('.opy-header', {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingBottom: 8,
  borderBottom: `1px solid ${theme.outputPort}`,
  color: theme.outputPort,
  fontFamily: mono,
});
globalStyle('.opy-header h2', { margin: 0, fontSize: 14 });
globalStyle('.opy-lens', {
  flex: '0 0 24px',
  height: 24,
  border: `1px solid ${theme.danger}`,
  borderRadius: '50%',
  boxShadow: `0 0 7px color-mix(in srgb, ${theme.danger} 35%, transparent)`,
  background: `radial-gradient(circle, ${theme.danger} 22%, ${theme.raised} 43%, transparent 45%)`,
});
globalStyle('.opy-composer, .opy-card', {
  display: 'grid',
  gap: 8,
  paddingTop: 8,
  borderTop: `1px solid ${theme.rule}`,
  overflowWrap: 'anywhere',
});
globalStyle('.opy-composer textarea', { minHeight: 66, resize: 'vertical' });
globalStyle('.opy-card h3, .opy-card p, .opy-card blockquote, .opy-composer > p', { margin: 0 });
globalStyle('.opy-status', { color: theme.accent, fontWeight: 700 });

globalStyle('.team-history', {
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  height: '100%',
  minHeight: 0,
});

globalStyle('.team-history-controls', {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  maxHeight: '35vh',
  overflow: 'auto',
});

globalStyle('.team-history-controls label', {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
});
