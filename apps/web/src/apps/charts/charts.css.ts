import { globalStyle, style } from '@vanilla-extract/css';

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '1.25rem',
  width: '100%',
  maxWidth: '1100px',
});

export const cell = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '16px',
  padding: '1.25rem 1.5rem 1.5rem',
  minWidth: 0,
});

globalStyle(`${cell} svg:focus-visible`, {
  outline: '2px solid #6366f1',
  outlineOffset: '4px',
  borderRadius: '8px',
});

export const cellLabel = style({
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#aaa',
  marginBottom: '1rem',
});
