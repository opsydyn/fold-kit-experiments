import { globalStyle, keyframes, style } from '@vanilla-extract/css';

export const root = style({
  border: '1px solid #303b49',
  borderRadius: '8px',
  background: '#111720',
  overflow: 'hidden',
  lineHeight: 1.6,
  color: '#dce5ed',
  fontSize: '0.875rem',
  fontVariantNumeric: 'tabular-nums',
});
export const header = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(200px, 2fr) repeat(3, minmax(120px, 1fr))',
  gap: '1rem',
  borderBottom: '1px solid #303b49',
  padding: '1rem 1.25rem',
  '@media': {
    '(max-width: 800px)': { gridTemplateColumns: '1fr 1fr' },
    '(max-width: 480px)': { gridTemplateColumns: '1fr' },
  },
});
export const current = style({ color: '#79dce4', fontWeight: 700 });
export const workspace = style({
  display: 'grid',
  gridTemplateColumns: '200px minmax(0, 1fr) 280px',
  '@media': {
    '(max-width: 1100px)': { gridTemplateColumns: '180px minmax(0, 1fr)' },
    '(max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
});
export const rail = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  borderRight: '1px solid #303b49',
  padding: '1rem',
  minWidth: 0,
});
export const inspector = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  borderLeft: '1px solid #303b49',
  padding: '1rem',
  minWidth: 0,
  overflowWrap: 'anywhere',
  '@media': {
    '(max-width: 1100px)': { gridColumn: '1 / -1', borderTop: '1px solid #303b49', borderLeft: 0 },
  },
});
export const graph = style({ padding: '1rem', minWidth: 0 });
export const sectionHeading = style({
  marginBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#a7b9ca',
  fontSize: '0.75rem',
  fontWeight: 600,
});
export const muted = style({ color: '#9babbb', fontSize: '0.8rem' });
export const controls = style({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' });
export const control = style({
  border: '1px solid #4a5a70',
  borderRadius: '4px',
  background: '#202a38',
  cursor: 'pointer',
  padding: '0.45rem 0.7rem',
  minHeight: '36px',
  color: '#e3edf5',
  font: 'inherit',
  selectors: {
    '&:disabled': { opacity: 0.45, cursor: 'default' },
    '&:hover:not(:disabled)': { background: '#303f52' },
  },
});
export const graphScroll = style({ overflowX: 'auto' });
export const edge = style({
  cursor: 'pointer',
  color: '#71829a',
  selectors: { '&:hover': { color: '#c3caff' } },
});
export const visitedEdge = style({ color: '#939dee' });
export const edgeLabel = style({
  fontSize: '11px',
  fill: 'currentColor',
  stroke: '#111720',
  strokeWidth: 4,
  paintOrder: 'stroke',
  textAnchor: 'middle',
});
export const node = style({ cursor: 'pointer', color: '#71829a' });
export const visitedNode = style({ color: '#939dee' });
export const errorNode = style({ color: '#ed9696' });
export const activeNode = style({ color: '#79dce4' });
export const selectedNode = style({ strokeDasharray: '4 3' });
export const nodeLabel = style({
  fontSize: '14px',
  fontWeight: 600,
  fill: '#e3edf5',
  stroke: 'none',
  textAnchor: 'middle',
});
export const nodeStatus = style({
  fontSize: '11px',
  fill: 'currentColor',
  stroke: 'none',
  textAnchor: 'middle',
});
const transitionPulse = keyframes({
  '0%': { opacity: 0.3 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.8 },
});
export const pulse = style({
  animation: `${transitionPulse} 700ms ease-out`,
  color: '#79dce4',
  '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } },
});
export const keySummary = style({ cursor: 'pointer', padding: '0.5rem 0', color: '#a7b9ca' });
export const edgeKey = style({
  paddingLeft: '1.5rem',
  maxHeight: '180px',
  overflowY: 'auto',
  overflowWrap: 'anywhere',
  fontSize: '0.75rem',
});
export const eventName = style({ minHeight: '3rem', color: '#c3caff', fontWeight: 600 });
export const eventData = style({
  borderTop: '1px solid #303b49',
  paddingTop: '0.5rem',
  maxHeight: '320px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  fontSize: '0.75rem',
});
export const timeline = style({ borderTop: '1px solid #303b49', padding: '1rem 1.25rem' });
export const tableScroll = style({ marginTop: '0.75rem', overflowX: 'auto' });
export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontSize: '0.8rem',
});
export const relatedRow = style({ background: '#242b42' });
export const eventButton = style({
  border: 0,
  borderRadius: '3px',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.35rem',
  color: '#b9c2ff',
  font: 'inherit',
  selectors: { '&[aria-pressed="true"]': { background: '#333d60', textDecoration: 'underline' } },
});
globalStyle(
  `${root} button:focus-visible, ${root} summary:focus-visible, ${root} [tabindex]:focus-visible`,
  { outline: '2px solid #e8c67a', outlineOffset: '3px' },
);
globalStyle(`${table} th, ${table} td`, {
  borderBottom: '1px solid #26313e',
  padding: '0.45rem 0.75rem',
});
