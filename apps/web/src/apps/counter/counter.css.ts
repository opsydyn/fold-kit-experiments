import { style } from '@vanilla-extract/css';

export const scene = style({
  position: 'relative',
  width: '100%',
  height: '100vh',
  overflow: 'hidden',
  background: '#fafafa',
  fontFamily: 'system-ui, sans-serif',
});

export const canvas = style({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
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
  fontSize: '6rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  color: '#111',
  lineHeight: 1,
});

export const controls = style({
  display: 'flex',
  gap: '0.75rem',
});

export const button = style({
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
