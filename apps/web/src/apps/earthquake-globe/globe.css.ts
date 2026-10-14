import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  marginInline: 'auto',
  minWidth: 0,
  maxWidth: '1200px',
  color: 'var(--page-text)',
});
globalStyle(`${root} a`, {
  textDecoration: 'underline',
  color: 'inherit',
  textUnderlineOffset: '2px',
});
export const workspace = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)',
  alignItems: 'start',
  gap: '2rem',
  '@media': { '(max-width: 800px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
});
export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.375rem',
  marginBlock: '1rem',
});
export const iconButton = style({
  display: 'grid',
  flexShrink: 0,
  placeItems: 'center',
  border: '1px solid var(--toggle-border)',
  borderRadius: '6px',
  background: 'transparent',
  cursor: 'pointer',
  width: '2rem',
  height: '2rem',
  color: 'var(--page-text)',
  fontSize: '1rem',
  selectors: {
    '&:hover': { background: 'var(--toggle-hover-bg)' },
    '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '3px' },
  },
});
export const globe = style({
  aspectRatio: '1',
  display: 'block',
  cursor: 'grab',
  touchAction: 'none',
  width: '100%',
  maxWidth: '640px',
  userSelect: 'none',
  selectors: { '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '3px' } },
});
export const side = style({ paddingTop: '1rem', minWidth: 0 });
export const heading = style({ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 });
export const metadata = style({
  overflowWrap: 'anywhere',
  lineHeight: '1.6',
  fontSize: '0.8125rem',
});
export const details = style({
  marginTop: '1.5rem',
  borderTop: '1px solid var(--nav-border)',
  paddingTop: '1.5rem',
  minHeight: '12rem',
  overflowWrap: 'anywhere',
  lineHeight: '1.6',
});
export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  marginBlock: '0.625rem',
  fontSize: '0.8125rem',
});
export const swatch = style({
  display: 'inline-block',
  border: '1px solid currentColor',
  width: '0.75rem',
  height: '0.75rem',
});
export const tableScroll = style({
  marginTop: '2rem',
  borderTop: '1px solid var(--nav-border)',
  overflowX: 'auto',
});
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
  textDecoration: 'underline',
  color: 'var(--page-text)',
  font: 'inherit',
  selectors: { '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '3px' } },
});
globalStyle(`${table} th, ${table} td`, {
  borderBottom: '1px solid var(--nav-border)',
  padding: '0.625rem 0.75rem',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
});
globalStyle(`${table} caption`, { paddingBlock: '1rem', textAlign: 'left', fontWeight: 600 });
globalStyle(`${table} tr[aria-selected="true"]`, { background: 'var(--toggle-hover-bg)' });
globalStyle(`${globe} [role="button"]:focus-visible circle`, {
  stroke: 'var(--page-text)',
  strokeWidth: 3,
});
