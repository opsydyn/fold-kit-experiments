import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  background: '#fff',
  padding: '2rem',
  maxWidth: '400px',
});

export const greeting = style({
  lineHeight: 1.2,
  color: '#111',
  fontSize: '2rem',
  fontWeight: 700,
});

export const empty = style({
  color: '#888',
  fontSize: '1rem',
});

export const link = style({
  alignSelf: 'flex-start',
  textDecoration: 'none',
  color: '#555',
  fontSize: '0.875rem',
  selectors: {
    '&:hover': { textDecoration: 'underline', color: '#111' },
  },
});
