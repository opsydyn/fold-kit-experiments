import { style } from '@vanilla-extract/css';

export const root = style({
  maxWidth: '640px',
  userSelect: 'none',
  selectors: {
    '&:focus-visible': { outline: '2px solid #111', outlineOffset: '4px', borderRadius: '12px' },
  },
});

export const track = style({
  borderRadius: '12px',
  overflow: 'hidden',
});

export const slideContainer = style({
  display: 'flex',
});

export const slide = style({
  display: 'flex',
  flex: '0 0 100%',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: '2rem',
  minWidth: 0,
  height: '320px',
});

export const slideNumber = style({
  opacity: 0.25,
  lineHeight: 1,
  color: '#111',
  fontSize: '4rem',
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
});

export const slideTitle = style({
  marginTop: '0.25rem',
  lineHeight: 1.2,
  color: '#111',
  fontSize: '1.75rem',
  fontWeight: 700,
});

export const slideCaption = style({
  marginTop: '0.5rem',
  color: '#555',
  fontSize: '0.9rem',
});

export const controls = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '1rem',
});

export const arrows = style({
  display: 'flex',
  gap: '0.5rem',
});

export const arrowButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 120ms, border-color 120ms',
  border: '1px solid #e5e5e5',
  borderRadius: '50%',
  background: '#fff',
  cursor: 'pointer',
  width: '2.25rem',
  height: '2.25rem',
  color: '#111',
  fontSize: '1rem',
  selectors: {
    '&:hover': { borderColor: '#ccc', background: '#f5f5f5' },
    '&:active': { background: '#ebebeb' },
    '&[aria-disabled="true"]': { opacity: 0.3, cursor: 'default', pointerEvents: 'none' },
  },
});

export const dots = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
});

export const dot = style({
  transition: 'background 150ms, width 150ms',
  border: 'none',
  borderRadius: '50%',
  background: '#d4d4d4',
  cursor: 'pointer',
  padding: 0,
  width: '0.5rem',
  height: '0.5rem',
  selectors: {
    '&[data-active]': { borderRadius: '999px', background: '#111', width: '1.25rem' },
  },
});
