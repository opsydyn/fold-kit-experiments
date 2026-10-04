import { globalStyle, keyframes, style } from '@vanilla-extract/css';

const typography = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' };
export const root = style({
  border: '1px solid var(--sf-line)',
  borderRadius: 0,
  background: 'var(--sf-bg)',
  overflow: 'hidden',
  lineHeight: 1.5,
  color: 'var(--sf-text)',
  fontSize: '0.8125rem',
  vars: {
    '--sf-bg': '#0b1016',
    '--sf-panel': '#111820',
    '--sf-line': '#34404e',
    '--sf-grid': '#283440',
    '--sf-text': '#f1f5fa',
    '--sf-muted': '#a0afc0',
    '--sf-wire': '#738397',
    '--sf-blue': '#5477ff',
    '--sf-cyan': '#00e0c4',
    '--sf-error': '#ff6746',
    '--sf-focus': '#e9ff54',
    '--sf-tint': '#172b32',
  },
  fontVariantNumeric: 'tabular-nums',
});
globalStyle(`[data-theme="light"] .${root}`, {
  vars: {
    '--sf-bg': '#f8fafb',
    '--sf-panel': '#ffffff',
    '--sf-line': '#b8c3cf',
    '--sf-grid': '#d3dbe3',
    '--sf-text': '#101b29',
    '--sf-muted': '#526176',
    '--sf-wire': '#63748a',
    '--sf-blue': '#2453ec',
    '--sf-cyan': '#007d76',
    '--sf-error': '#c5361c',
    '--sf-focus': '#7d5100',
    '--sf-tint': '#e5f2f1',
  },
});
export const header = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(170px, 1.4fr) repeat(3, minmax(120px, 1fr)) auto',
  alignItems: 'center',
  gap: '0.75rem 1rem',
  borderBottom: '1px solid var(--sf-line)',
  background: 'var(--sf-panel)',
  padding: '0.875rem 1rem',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
  '@media': { '(max-width: 1000px)': { gridTemplateColumns: '1fr 1fr' } },
});
export const current = style({
  color: 'var(--sf-blue)',
  fontWeight: 700,
  selectors: {
    '&::before': {
      display: 'inline-block',
      marginRight: '8px',
      background: 'currentColor',
      width: '7px',
      height: '7px',
      content: '""',
    },
  },
});
export const workspace = style({
  display: 'grid',
  gridTemplateColumns: '176px minmax(0, 1fr) 248px',
  '@media': {
    '(max-width: 1400px)': { gridTemplateColumns: '176px minmax(0, 1fr)' },
    '(max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});
export const rail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  borderRight: '1px solid var(--sf-line)',
  background: 'var(--sf-panel)',
  padding: '1rem',
  minWidth: 0,
  '@media': { '(max-width: 700px)': { borderRight: 0, borderBottom: '1px solid var(--sf-line)' } },
});
export const inspector = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  borderLeft: '1px solid var(--sf-line)',
  background: 'var(--sf-panel)',
  padding: '1rem',
  minWidth: 0,
  overflowWrap: 'anywhere',
  '@media': {
    '(max-width: 1400px)': {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gridColumn: '1 / -1',
      gap: '0.5rem 1.5rem',
      borderTop: '1px solid var(--sf-line)',
      borderLeft: 0,
    },
    '(max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});
globalStyle(`.${inspector} h2, .${inspector} pre`, { gridColumn: '1 / -1' });
export const graph = style({ padding: '1rem', minWidth: 0 });
export const sectionHeading = style({
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--sf-muted)',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
  fontWeight: 600,
});
export const muted = style({ color: 'var(--sf-muted)', fontSize: '0.75rem' });
export const controls = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.375rem',
  '@media': { '(max-width: 700px)': { gridTemplateColumns: 'repeat(4, 1fr)' } },
});
export const control = style({
  border: '1px solid var(--sf-line)',
  borderRadius: 0,
  background: 'var(--sf-bg)',
  cursor: 'pointer',
  padding: '0.5rem',
  minHeight: '40px',
  color: 'var(--sf-text)',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
  fontWeight: 600,
  selectors: {
    '&:disabled': { opacity: 0.4, cursor: 'default' },
    '&:hover:not(:disabled)': { borderColor: 'var(--sf-blue)', color: 'var(--sf-blue)' },
    '&:first-child:not(:disabled)': {
      borderColor: 'var(--sf-blue)',
      background: 'var(--sf-blue)',
      color: '#ffffff',
    },
  },
});
export const graphScroll = style({
  border: '1px solid var(--sf-line)',
  backgroundImage: 'radial-gradient(var(--sf-grid) 0.8px, transparent 0.8px)',
  backgroundPosition: '12px 12px',
  backgroundSize: '24px 24px',
  overflowX: 'auto',
  scrollbarColor: 'var(--sf-wire) var(--sf-bg)',
});
export const edge = style({
  cursor: 'pointer',
  color: 'var(--sf-wire)',
  selectors: { '&:hover': { color: 'var(--sf-text)' } },
});
export const route = style({
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
});
export const guardedEdge = style({ vars: { '--sf-guard-dash': '1 6' } });
globalStyle(`.${guardedEdge} .${route}`, { strokeDasharray: '1 6' });
export const visitedEdge = style({ color: 'var(--sf-cyan)' });
globalStyle(`.${visitedEdge} .${route}`, { strokeWidth: 2, strokeDasharray: 'none' });
export const latestEdge = style({ color: 'var(--sf-blue)' });
globalStyle(`.${latestEdge} .${route}`, { strokeWidth: 2.5, strokeDasharray: 'none' });
export const selectedEdge = style({ color: 'var(--sf-focus)' });
globalStyle(`.${selectedEdge} .${route}`, { strokeWidth: 3, strokeDasharray: 'none' });
export const edgeLabel = style({
  fontFamily: typography.fontFamily,
  fontSize: '12px',
  fontWeight: 600,
  fill: 'currentColor',
  stroke: 'none',
  textAnchor: 'middle',
});
export const badge = style({ fill: 'var(--sf-bg)', stroke: 'currentColor', strokeWidth: 1 });
export const node = style({ cursor: 'pointer', color: 'var(--sf-wire)' });
export const terminal = style({
  fill: 'var(--sf-panel)',
  stroke: 'currentColor',
  strokeWidth: 1.5,
});
export const visitedNode = style({ color: 'var(--sf-cyan)' });
export const errorNode = style({ color: 'var(--sf-error)' });
export const activeNode = style({ color: 'var(--sf-blue)' });
globalStyle(`.${activeNode} .${terminal}`, { fill: 'var(--sf-blue)', strokeWidth: 2 });
export const selectedNode = style({ vars: { '--sf-bracket-opacity': '1' } });
export const selectionBracket = style({
  opacity: 'var(--sf-bracket-opacity, 0)',
  fill: 'none',
  stroke: 'var(--sf-focus)',
  strokeWidth: 2,
});
export const nodeLabel = style({
  fontSize: '15px',
  fontWeight: 700,
  fill: 'var(--sf-text)',
  stroke: 'none',
  textAnchor: 'middle',
});
export const nodeStatus = style({
  fontFamily: typography.fontFamily,
  fontSize: '12px',
  fill: 'currentColor',
  stroke: 'none',
  textAnchor: 'middle',
});
globalStyle(`.${activeNode} .${nodeLabel}, .${activeNode} .${nodeStatus}`, { fill: '#ffffff' });
const transitionPulse = keyframes({
  '0%': { opacity: 0.45 },
  '60%': { opacity: 1 },
  '100%': { opacity: 1 },
});
export const pulse = style({
  animation: `${transitionPulse} 500ms ease-out`,
  '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } },
});
export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1.25rem',
  margin: '0.75rem 0',
  listStyle: 'none',
  color: 'var(--sf-muted)',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
});
export const legendActive = style({ borderLeft: '8px solid var(--sf-blue)', paddingLeft: '8px' });
export const legendVisited = style({ borderLeft: '8px solid var(--sf-cyan)', paddingLeft: '8px' });
export const legendGuard = style({ borderLeft: '2px dotted var(--sf-wire)', paddingLeft: '8px' });
export const legendError = style({ borderLeft: '8px solid var(--sf-error)', paddingLeft: '8px' });
export const keySummary = style({
  cursor: 'pointer',
  padding: '0.5rem 0',
  color: 'var(--sf-muted)',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
});
export const edgeKey = style({
  paddingLeft: '1.5rem',
  maxHeight: '180px',
  overflowY: 'auto',
  overflowWrap: 'anywhere',
  fontSize: '0.75rem',
});
export const eventName = style({
  color: 'var(--sf-blue)',
  fontFamily: typography.fontFamily,
  fontWeight: 700,
});
export const eventData = style({
  borderTop: '1px dotted var(--sf-line)',
  paddingTop: '0.75rem',
  maxHeight: '280px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
});
export const timeline = style({ borderTop: '1px solid var(--sf-line)', padding: '1rem' });
export const tableScroll = style({ marginTop: '0.75rem', overflowX: 'auto' });
export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontFamily: typography.fontFamily,
  fontSize: '0.75rem',
});
export const relatedRow = style({ background: 'var(--sf-tint)' });
export const eventButton = style({
  border: 0,
  borderRadius: 0,
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.25rem 0',
  color: 'var(--sf-blue)',
  font: 'inherit',
  fontWeight: 600,
  selectors: {
    '&[aria-pressed="true"]': {
      textDecoration: 'underline',
      color: 'var(--sf-text)',
      textUnderlineOffset: '4px',
    },
  },
});
globalStyle(
  `.${root} button:focus-visible, .${root} summary:focus-visible, .${root} [tabindex]:focus-visible`,
  { outline: '2px solid var(--sf-focus)', outlineOffset: '4px' },
);
globalStyle(`.${table} th, .${table} td`, {
  borderBottom: '1px dotted var(--sf-line)',
  padding: '0.65rem 0.75rem',
});
globalStyle(`.${table} th`, { color: 'var(--sf-muted)', fontWeight: 500 });
