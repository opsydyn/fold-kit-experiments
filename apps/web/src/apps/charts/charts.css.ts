import { globalStyle, style } from '@vanilla-extract/css';

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1.25rem',
  width: '100%',
  maxWidth: '1100px',
});

export const cell = style({
  transition: 'background 180ms, border-color 180ms',
  border: '1px solid var(--card-border, #1e1e33)',
  borderRadius: '16px',
  background: 'var(--card-bg, #12121f)',
  padding: '1.25rem 1.5rem 1.5rem',
  minWidth: 0,
});

globalStyle(`${cell} svg:focus-visible`, {
  outline: '2px solid var(--chart-accent, #6366f1)',
  outlineOffset: '4px',
  borderRadius: '8px',
});

export const cellLabel = style({
  marginBottom: '1rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--card-label, #7070a0)',
  fontSize: '0.7rem',
  fontWeight: 600,
});

/** The standalone explorations above the gallery: whole-card links with a kind, name and summary. */
export const features = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '1rem',
  marginBottom: '2.5rem',
  width: '100%',
  maxWidth: '1100px',
});

export const feature = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  transition: 'border-color 180ms, transform 180ms',
  border: '1px solid var(--card-border, #1e1e33)',
  borderRadius: '14px',
  background: 'var(--card-bg, #12121f)',
  padding: '1.1rem 1.25rem 1.25rem',
  minWidth: 0,
  color: 'var(--page-text, #e8e8ff)',
  textDecoration: 'none',
  selectors: {
    '&:hover': { borderColor: 'var(--chart-accent, #6366f1)', transform: 'translateY(-2px)' },
    '&:focus-visible': {
      outline: '2px solid var(--chart-accent, #6366f1)',
      outlineOffset: '3px',
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'border-color 180ms',
      selectors: { '&:hover': { transform: 'none' } },
    },
  },
});

export const featureKind = style({
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--card-label, #7070a0)',
  fontSize: '0.7rem',
  fontWeight: 600,
});

export const featureName = style({
  margin: 0,
  fontSize: '1.05rem',
  fontWeight: 600,
});

export const featureSummary = style({
  flex: 1,
  margin: 0,
  lineHeight: 1.45,
  color: 'var(--toggle-text, #a0a0c0)',
  fontSize: '0.875rem',
});

export const featureOpen = style({
  color: 'var(--chart-accent, #6366f1)',
  fontSize: '0.8125rem',
  fontWeight: 600,
});

export const sectionHeading = style({
  marginBottom: '1rem',
  color: 'var(--page-text, #e8e8ff)',
  fontSize: '1.05rem',
  fontWeight: 600,
});
