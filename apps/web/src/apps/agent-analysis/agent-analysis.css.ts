import { globalStyle, style } from '@vanilla-extract/css';

export const root = style({
  margin: '0 auto',
  minWidth: 0,
  maxWidth: '1120px',
  color: 'var(--page-text)',
  vars: {
    '--incident-core': '#58c6ba',
    '--incident-platform': '#ee93ac',
    '--incident-budget': '#d8b65e',
  },
  selectors: {
    '[data-theme="light"] &': {
      vars: {
        '--incident-core': '#007d75',
        '--incident-platform': '#b94264',
        '--incident-budget': '#876619',
      },
    },
  },
});
export const heading = style({ margin: 0, fontSize: '1rem', fontWeight: 600 });
export const eyebrow = style({
  margin: '0 0 0.4rem',
  color: 'var(--chart-label)',
  fontSize: '0.75rem',
});
export const muted = style({
  margin: '0.4rem 0 0',
  lineHeight: 1.6,
  color: 'var(--chart-label)',
  fontSize: '0.75rem',
});
export const controls = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.6rem',
  paddingBottom: '1.25rem',
});
export const control = style({
  border: '1px solid var(--toggle-border)',
  borderRadius: '4px',
  background: 'var(--card-bg)',
  cursor: 'pointer',
  padding: '0.5rem 0.75rem',
  color: 'var(--page-text)',
  font: 'inherit',
  fontSize: '0.875rem',
  selectors: {
    '&:disabled': { opacity: 0.45, cursor: 'default' },
    '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '3px' },
  },
});
export const primary = style([
  control,
  {
    borderColor: 'var(--incident-core)',
    background: 'var(--incident-core)',
    color: 'var(--page-bg)',
    fontWeight: 600,
  },
]);
export const labLabel = style({
  marginLeft: 'auto',
  color: 'var(--chart-label)',
  fontSize: '0.75rem',
  '@media': { '(max-width: 700px)': { flexBasis: '100%', marginLeft: 0 } },
});
export const summary = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr) minmax(0, 1fr)',
  gap: '1.25rem',
  borderTop: '1px solid var(--card-border)',
  borderBottom: '1px solid var(--card-border)',
  padding: '1.25rem 0',
  '@media': { '(max-width: 700px)': { gridTemplateColumns: '1fr 1fr', gap: '1rem' } },
});
globalStyle(`${summary} > div:first-child`, {
  '@media': { '(max-width: 700px)': { gridColumn: '1 / -1' } },
});
export const headline = style({
  margin: 0,
  lineHeight: 1.35,
  fontSize: '1.25rem',
  fontWeight: 600,
});
export const stat = style({
  margin: 0,
  lineHeight: 1.2,
  fontSize: '1.75rem',
  fontVariantNumeric: 'tabular-nums',
});
export const unit = style({ color: 'var(--chart-label)', fontSize: '0.75rem', fontWeight: 400 });
export const workspace = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 270px',
  '@media': { '(max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' } },
});
export const plotRegion = style({
  padding: '1.25rem 1.5rem 1.25rem 0',
  minWidth: 0,
  '@media': { '(max-width: 700px)': { padding: '1.25rem 0' } },
});
export const sectionHeader = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
});
export const legend = style({ margin: 0, color: 'var(--chart-label)', fontSize: '0.7rem' });
export const chart = style({
  marginTop: '0.6rem',
  width: '100%',
  minWidth: 0,
  selectors: { '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '2px' } },
});
globalStyle(`${chart} svg`, {
  aspectRatio: '760 / 370',
  height: 'auto',
  '@media': { '(max-width: 700px)': { aspectRatio: '390 / 330' } },
});
export const inspector = style({
  borderLeft: '1px solid var(--card-border)',
  padding: '1.25rem 0 1.25rem 1.5rem',
  minWidth: 0,
  '@media': {
    '(max-width: 700px)': {
      borderTop: '1px solid var(--card-border)',
      borderLeft: 0,
      padding: '1.25rem 0',
    },
  },
});
export const serviceName = style({
  margin: '0.5rem 0 0',
  overflowWrap: 'anywhere',
  fontSize: '1.5rem',
  fontWeight: 600,
});
export const measurement = style({
  margin: '1rem 0 0.25rem',
  lineHeight: 1.1,
  fontSize: '2.75rem',
  fontVariantNumeric: 'tabular-nums',
});
export const comparison = style({
  margin: '0.5rem 0 0',
  color: 'var(--chart-label)',
  fontSize: '0.75rem',
});
export const good = style({ color: 'var(--incident-core)', fontSize: '0.8rem' });
export const alert = style({
  color: 'var(--incident-platform)',
  fontSize: '0.8rem',
  fontWeight: 600,
});
export const facts = style({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '0.6rem',
  margin: '1.25rem 0 0',
  borderTop: '1px solid var(--card-border)',
  paddingTop: '1rem',
  fontSize: '0.75rem',
});
globalStyle(`${facts} dt`, { color: 'var(--chart-label)' });
globalStyle(`${facts} dd`, { margin: 0, overflowWrap: 'anywhere', textAlign: 'right' });
export const evidenceNote = style({
  marginTop: '1.25rem',
  borderLeft: '2px solid var(--incident-core)',
  paddingLeft: '0.75rem',
  lineHeight: 1.6,
  fontSize: '0.75rem',
});
export const rejection = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  marginTop: '1rem',
  borderLeft: '3px solid var(--incident-platform)',
  background: 'var(--card-bg)',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  '@media': { '(max-width: 700px)': { flexDirection: 'column', alignItems: 'flex-start' } },
});
globalStyle(`${rejection} > div`, { minWidth: 0 });
globalStyle(`${rejection} pre`, {
  margin: '0.5rem 0 0',
  maxHeight: '8rem',
  overflowY: 'auto',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  color: 'var(--chart-label)',
  fontSize: '0.7rem',
});
export const empty = style({ padding: '1rem 0', fontSize: '0.875rem' });
export const lower = style([workspace, { borderTop: '1px solid var(--card-border)' }]);
export const tableRegion = style({
  padding: '1.25rem 1.5rem 0 0',
  minWidth: 0,
  '@media': { '(max-width: 700px)': { paddingRight: 0 } },
});
export const filters = style({ display: 'flex', gap: '0.25rem' });
export const filter = style([
  control,
  {
    border: 0,
    borderRadius: 0,
    background: 'transparent',
    padding: '0.3rem 0.5rem',
    fontSize: '0.75rem',
    selectors: { '&[aria-pressed="true"]': { boxShadow: 'inset 0 -2px var(--page-text)' } },
  },
]);
export const scroll = style({
  marginTop: '0.6rem',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'auto',
  selectors: { '&:focus-visible': { outline: '2px solid var(--page-text)', outlineOffset: '2px' } },
});
export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
  fontSize: '0.8rem',
  fontVariantNumeric: 'tabular-nums',
});
globalStyle(`${table} th, ${table} td`, {
  borderBottom: '1px solid var(--card-border)',
  padding: '0.7rem 0.5rem',
  '@media': { '(max-width: 700px)': { padding: '0.6rem 0.25rem', fontSize: '0.7rem' } },
});
globalStyle(`${table} td, ${table} thead th:not(:first-child)`, { textAlign: 'right' });
globalStyle(`${table} thead th`, { color: 'var(--chart-label)', fontWeight: 400 });
globalStyle(`${table} abbr`, { textDecoration: 'none' });
globalStyle(`${table} tr[data-selected="true"]`, { background: 'var(--card-bg)' });
export const serviceButton = style([
  control,
  {
    border: 0,
    background: 'transparent',
    padding: '0.2rem 0',
    textAlign: 'left',
    fontSize: 'inherit',
    fontWeight: 600,
    selectors: {
      '&[aria-pressed="true"]': { textDecoration: 'underline', textUnderlineOffset: '4px' },
    },
  },
]);
export const activity = style({
  borderLeft: '1px solid var(--card-border)',
  padding: '1.25rem 0 0 1.5rem',
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontSize: '0.75rem',
  '@media': { '(max-width: 700px)': { borderLeft: 0, paddingLeft: 0 } },
});
globalStyle(`${activity} ol`, { margin: '0.75rem 0', paddingLeft: '1rem', lineHeight: 1.7 });
globalStyle(`${activity} details`, { borderTop: '1px solid var(--card-border)' });
globalStyle(`${activity} summary`, {
  cursor: 'pointer',
  padding: '0.6rem 0',
  color: 'var(--chart-label)',
});
export const footer = style({
  marginTop: '1.5rem',
  borderTop: '1px solid var(--card-border)',
  paddingTop: '0.75rem',
  lineHeight: 1.6,
  color: 'var(--chart-label)',
  fontSize: '0.7rem',
});
export const srOnly = style({
  position: 'absolute',
  clipPath: 'inset(50%)',
  margin: '-1px',
  border: 0,
  padding: 0,
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});
