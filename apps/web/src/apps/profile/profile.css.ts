import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  background: '#fff',
  padding: '2rem',
  maxWidth: '400px',
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
});

export const label = style({
  color: '#555',
  fontSize: '0.875rem',
  fontWeight: 600,
});

export const input = style({
  outline: 'none',
  border: '1px solid #d5d5d5',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  color: '#111',
  fontSize: '1rem',
  selectors: {
    '&:focus': { borderColor: '#111', boxShadow: '0 0 0 2px rgba(0,0,0,0.08)' },
  },
});

export const button = style({
  alignSelf: 'flex-start',
  transition: 'background 150ms',
  border: 'none',
  borderRadius: '6px',
  background: '#111',
  cursor: 'pointer',
  padding: '0.5rem 1.25rem',
  color: '#fff',
  fontSize: '0.875rem',
  fontWeight: 500,
  selectors: {
    '&:hover': { background: '#333' },
    '&:active': { background: '#555' },
  },
});

export const saved = style({
  color: '#16a34a',
  fontSize: '0.875rem',
  fontWeight: 500,
});

export const link = style({
  textDecoration: 'none',
  color: '#555',
  fontSize: '0.875rem',
  selectors: {
    '&:hover': { textDecoration: 'underline', color: '#111' },
  },
});
