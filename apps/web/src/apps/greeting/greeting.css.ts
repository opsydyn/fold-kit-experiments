import { style } from '@vanilla-extract/css';

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  padding: '2rem',
  maxWidth: '400px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
});

export const greeting = style({
  fontSize: '2.5rem',
  fontWeight: 700,
  color: '#111',
  lineHeight: 1.2,
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
