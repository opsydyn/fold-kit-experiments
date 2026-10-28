import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  marginInline: 'auto',
  minWidth: 0,
  maxWidth: '1100px',
  color: 'var(--page-text)',
});
export const notice = style({
  marginBottom: '0.75rem',
  lineHeight: 1.4,
  color: 'var(--chart-label)',
  fontSize: '0.8125rem',
});
export const filters = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
  gap: '0.5rem',
  '@media': { '(max-width: 800px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
});
export const field = style({ display: 'grid', gap: '0.25rem', minWidth: 0, fontSize: '0.8125rem' });
export const input = style({
  border: '1px solid var(--toggle-border)',
  borderRadius: '4px',
  background: 'var(--page-bg)',
  padding: '0.5rem',
  width: '100%',
  minWidth: 0,
  color: 'var(--page-text)',
  font: 'inherit',
});
export const rings = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1rem',
  marginBlock: '0.75rem',
  border: 0,
  fontSize: '0.8125rem',
});
export const checkLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  cursor: 'pointer',
});
export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.375rem',
  marginBottom: '0.75rem',
  fontSize: '0.8125rem',
});
export const button = style({
  display: 'grid',
  flexShrink: 0,
  placeItems: 'center',
  border: '1px solid var(--toggle-border)',
  borderRadius: '4px',
  background: 'transparent',
  cursor: 'pointer',
  width: '2rem',
  height: '2rem',
  color: 'var(--page-text)',
  fontSize: '1rem',
});
export const clear = style({
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.25rem',
  textDecoration: 'underline',
  color: 'var(--page-text)',
  font: 'inherit',
});
export const workspace = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(230px, 1fr) minmax(0, 2fr)',
  alignItems: 'start',
  gap: '1.5rem',
  '@media': { '(max-width: 800px)': { gridTemplateColumns: 'minmax(0, 1fr)', gap: '0.5rem' } },
});
export const details = style({
  borderTop: '1px solid var(--nav-border)',
  paddingBlock: '0.75rem',
  minHeight: '10rem',
  overflowWrap: 'anywhere',
  lineHeight: 1.4,
  fontSize: '0.875rem',
  '@media': { '(max-width: 800px)': { paddingBlock: '0.5rem', minHeight: '5rem' } },
});
export const name = style({ fontSize: '1rem', fontWeight: 600 });
export const summary = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.375rem 1rem',
  marginBlock: '0.375rem',
  fontSize: '0.8125rem',
});
export const description = style({ marginBlock: '0.5rem', fontSize: '0.8125rem' });
export const globe = style({
  aspectRatio: '1',
  display: 'block',
  cursor: 'grab',
  touchAction: 'none',
  width: '100%',
  maxWidth: '640px',
  overflow: 'hidden',
  userSelect: 'none',
});
export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1rem',
  marginBlock: '0.75rem',
  fontSize: '0.8125rem',
});
export const swatch = style({
  display: 'inline-block',
  marginRight: '0.375rem',
  border: '1px solid var(--page-text)',
  width: '0.625rem',
  height: '0.625rem',
});
export const tableScroll = style({ marginTop: '1rem', overflowX: 'auto' });
export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: '0.8125rem',
});
export const inspect = style({
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  textDecoration: 'underline',
  color: 'var(--page-text)',
  font: 'inherit',
});
globalStyle(`${root} a`, {
  textDecoration: 'underline',
  color: 'var(--page-text)',
  textUnderlineOffset: '2px',
});
globalStyle(`${root} button:hover`, { background: 'var(--toggle-hover-bg)' });
globalStyle(`${root} :focus-visible`, {
  outline: '2px solid var(--page-text)',
  outlineOffset: '3px',
});
globalStyle(`${globe} [role="button"]:focus-visible circle`, {
  stroke: 'var(--page-text)',
  strokeWidth: 3,
});
globalStyle(`${table} th, ${table} td`, {
  borderBottom: '1px solid var(--nav-border)',
  padding: '0.625rem 0.5rem',
  verticalAlign: 'top',
});
globalStyle(`${table} caption`, { paddingBottom: '0.75rem', textAlign: 'left', fontWeight: 600 });
globalStyle(`${table} tr[aria-selected="true"]`, { background: 'var(--toggle-hover-bg)' });
