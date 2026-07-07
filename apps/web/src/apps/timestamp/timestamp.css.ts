import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  background: '#fff',
  padding: '1.25rem 1.5rem',
  maxWidth: '320px',
});

export const label = style({
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888',
  fontSize: '0.75rem',
  fontWeight: 600,
});

export const value = style({
  lineHeight: 1.1,
  color: '#111',
  fontSize: '2rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
});

export const sub = style({
  marginTop: '0.25rem',
  color: '#888',
  fontSize: '0.8rem',
});
