import { style } from '@vanilla-extract/css';

export const card = style({
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  background: '#fff',
  padding: '2rem',
  width: 'min(100%, 400px)',
});

export const greeting = style({
  lineHeight: 1.2,
  color: '#111',
  fontSize: '2.5rem',
  fontWeight: 700,
});

export const localeGroup = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.5rem',
  width: '100%',
});

export const localeButton = style({
  transition: 'background 150ms, color 150ms, border-color 150ms',
  border: '1px solid #b8b8b8',
  borderRadius: '6px',
  background: '#fff',
  cursor: 'pointer',
  padding: '0.55rem 0.75rem',
  minWidth: 0,
  color: '#111',
  fontSize: '0.875rem',
  fontWeight: 600,
  selectors: {
    '&:hover': { borderColor: '#111' },
  },
});

export const localeButtonSelected = style({
  borderColor: '#111',
  background: '#111',
  color: '#fff',
});

export const resetButton = style({
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
