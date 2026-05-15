import { style } from '@vanilla-extract/css';

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  maxWidth: '320px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
});

export const label = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888',
});

export const value = style({
  fontSize: '2rem',
  fontWeight: 700,
  color: '#111',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
});

export const sub = style({
  fontSize: '0.8rem',
  color: '#888',
  marginTop: '0.25rem',
});
