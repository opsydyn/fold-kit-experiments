import { globalStyle, style } from '@vanilla-extract/css';

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1.25rem',
  width: '100%',
  maxWidth: '1100px',
});

export const cell = style({
  background: 'var(--card-bg, #12121f)',
  border: '1px solid var(--card-border, #1e1e33)',
  borderRadius: '16px',
  padding: '1.25rem 1.5rem 1.5rem',
  minWidth: 0,
  transition: 'background 180ms, border-color 180ms',
});

globalStyle(`${cell} svg:focus-visible`, {
  outline: '2px solid var(--chart-accent, #6366f1)',
  outlineOffset: '4px',
  borderRadius: '8px',
});

export const cellLabel = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--card-label, #7070a0)',
  marginBottom: '1rem',
});
