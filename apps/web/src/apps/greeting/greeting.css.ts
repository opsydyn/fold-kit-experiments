import { style } from '@vanilla-extract/css';

export const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  background: '#fff',
  padding: '2rem',
  maxWidth: '400px',
});

export const greeting = style({
  lineHeight: 1.2,
  color: '#111',
  fontSize: '2.5rem',
  fontWeight: 700,
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
