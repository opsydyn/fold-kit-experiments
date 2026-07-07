import { style } from '@vanilla-extract/css';

export const scene = style({
  position: 'relative',
  background: '#fafafa',
  width: '100%',
  height: '100vh',
  overflow: 'hidden',
  fontFamily: 'system-ui, sans-serif',
});

export const canvas = style({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  width: '100%',
  height: '100%',
});

export const overlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2rem',
});

export const count = style({
  lineHeight: 1,
  color: '#111',
  fontSize: '6rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
});

export const controls = style({
  display: 'flex',
  gap: '0.75rem',
});

export const button = style({
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
