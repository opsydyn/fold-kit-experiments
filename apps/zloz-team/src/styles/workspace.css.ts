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
  display: 'grid',
  placeItems: 'center',
  border: `1px solid ${theme.accent}`,
  color: theme.accent,
  fontFamily: mono,
  fontWeight: 700,
  clipPath: cut,
});
globalStyle('.brand strong', {
  fontFamily: mono,
  fontSize: 16,
  letterSpacing: '.12em',
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
globalStyle('body:has(.shared-editor) .page-content.wide', {
  maxWidth: 1840,
  marginTop: 24,
  padding: '0 28px 28px',
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
  vars: { '--emphasis': theme.c4 },
  display: 'grid',
  gridTemplateColumns: '190px minmax(0, 1fr) 260px',
  gap: 16,
  alignItems: 'start',
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
  clipPath: cut,
  minWidth: 0,
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
globalStyle('.canvas-column', { minWidth: 0 });
globalStyle('.canvas-toolbar', {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  padding: '12px 16px',
  border: `1px solid ${theme.rule}`,
  background: theme.panel,
});
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
globalStyle('.canvas-alerts', { fontSize: 13 });
globalStyle('.canvas-alerts p', { margin: '10px 0' });
globalStyle('.shared-editor [data-flow-surface]', {
  backgroundImage: `radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--emphasis) 13%, transparent), transparent 70%), linear-gradient(color-mix(in srgb, ${theme.grid} 45%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${theme.grid} 45%, transparent) 1px, transparent 1px)`,
  backgroundSize: '100% 100%, 24px 24px, 24px 24px',
});
globalStyle('.shared-editor [data-flow-root]', { marginTop: 12 });
globalStyle('.shared-editor [data-flow-root] > div:first-child', {
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
globalStyle('.editor-inspector', { minHeight: 320 });
globalStyle('.editor-inspector input', { marginBottom: 10 });
globalStyle('.editor-inspector button', { width: '100%', marginBottom: 8 });
globalStyle('.inspector-hint', { fontSize: 12, marginBottom: 24 });
globalStyle('.shared-editor[data-inspector-mode="coupling"]', {
  gridTemplateColumns: '190px minmax(0, 1fr) 420px',
  '@media': {
    '(max-width: 1100px)': { gridTemplateColumns: '170px minmax(0, 1fr)' },
    '(max-width: 680px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});
globalStyle('.inspector-mode', { marginBottom: 20 });
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
  padding: '14px 0',
  fontSize: 11,
  color: theme.muted,
});
globalStyle('.presence strong', {
  fontFamily: mono,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  fontWeight: 500,
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
globalStyle('.shared-editor', {
  '@media': {
    '(max-width: 1100px)': { gridTemplateColumns: '170px minmax(0, 1fr)' },
    '(max-width: 680px)': { gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 },
  },
});
globalStyle('.editor-inspector', {
  '@media': { '(max-width: 1100px)': { gridColumn: '1 / -1', minHeight: 'auto' } },
});
globalStyle('.editor-actions', {
  '@media': { '(max-width: 680px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } },
});
globalStyle('.editor-actions button', {
  '@media': {
    '(max-width: 680px)': {
      padding: 8,
      fontSize: 10,
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
    },
  },
});
globalStyle('.site-header', {
  '@media': { '(max-width: 680px)': { padding: '12px 16px', gap: 10, flexWrap: 'wrap' } },
});
globalStyle('.page-content, body:has(.shared-editor) .page-content.wide', {
  '@media': { '(max-width: 680px)': { paddingLeft: 16, paddingRight: 16, marginTop: 24 } },
});
globalStyle('.invite-form button, .member-form button', {
  '@media': { '(max-width: 600px)': { width: '100%' } },
});
globalStyle('*', { '@media': { '(prefers-reduced-motion: reduce)': { scrollBehavior: 'auto' } } });

globalStyle('.tool-rail', {
  '@media': { '(max-width: 680px)': { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
});
globalStyle(
  '.tool-rail .rail-heading, .tool-rail .editor-actions, .tool-rail .mode-note, .tool-rail .role-label',
  { '@media': { '(max-width: 680px)': { gridColumn: '1 / -1', margin: 0 } } },
);
globalStyle('.tool-rail .tool-divider', {
  '@media': { '(max-width: 680px)': { display: 'none' } },
});
globalStyle('.tool-rail .canvas-mode', { '@media': { '(max-width: 680px)': { marginTop: 0 } } });
globalStyle('.tool-rail .button-link', {
  '@media': { '(max-width: 680px)': { alignSelf: 'end', fontSize: 10, padding: 8 } },
});
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
