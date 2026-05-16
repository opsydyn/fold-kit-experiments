import { style } from '@vanilla-extract/css';

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  padding: '2rem',
  maxWidth: '400px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

export const greeting = style({
  fontSize: '2rem',
  fontWeight: 700,
  color: '#111',
  lineHeight: 1.2,
});

export const empty = style({
  fontSize: '1rem',
  color: '#888',
});

export const link = style({
  alignSelf: 'flex-start',
  fontSize: '0.875rem',
  color: '#555',
  textDecoration: 'none',
  selectors: {
    '&:hover': { color: '#111', textDecoration: 'underline' },
  },
});
