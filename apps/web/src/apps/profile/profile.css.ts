import { style } from '@vanilla-extract/css';

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  padding: '2rem',
  maxWidth: '400px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
});

export const label = style({
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#555',
});

export const input = style({
  padding: '0.5rem 0.75rem',
  border: '1px solid #d5d5d5',
  borderRadius: '6px',
  fontSize: '1rem',
  color: '#111',
  outline: 'none',
  selectors: {
    '&:focus': { borderColor: '#111', boxShadow: '0 0 0 2px rgba(0,0,0,0.08)' },
  },
});

export const button = style({
  alignSelf: 'flex-start',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '6px',
  background: '#111',
  color: '#fff',
  padding: '0.5rem 1.25rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'background 150ms',
  selectors: {
    '&:hover': { background: '#333' },
    '&:active': { background: '#555' },
  },
});

export const saved = style({
  fontSize: '0.875rem',
  color: '#16a34a',
  fontWeight: 500,
});

export const link = style({
  fontSize: '0.875rem',
  color: '#555',
  textDecoration: 'none',
  selectors: {
    '&:hover': { color: '#111', textDecoration: 'underline' },
  },
});
