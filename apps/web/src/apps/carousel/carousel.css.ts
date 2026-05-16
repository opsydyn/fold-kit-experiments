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
  flex: '0 0 100%',
  minWidth: 0,
  height: '320px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: '2rem',
});

export const slideNumber = style({
  fontSize: '4rem',
  fontWeight: 800,
  lineHeight: 1,
  opacity: 0.25,
  color: '#111',
  fontVariantNumeric: 'tabular-nums',
});

export const slideTitle = style({
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111',
  lineHeight: 1.2,
  marginTop: '0.25rem',
});

export const slideCaption = style({
  fontSize: '0.9rem',
  color: '#555',
  marginTop: '0.5rem',
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
  width: '2.25rem',
  height: '2.25rem',
  borderRadius: '50%',
  border: '1px solid #e5e5e5',
  background: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  color: '#111',
  transition: 'background 120ms, border-color 120ms',
  selectors: {
    '&:hover': { background: '#f5f5f5', borderColor: '#ccc' },
    '&:active': { background: '#ebebeb' },
    '&[aria-disabled="true"]': { opacity: 0.3, cursor: 'default', pointerEvents: 'none' },
  },
});

export const dots = style({
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'center',
});

export const dot = style({
  width: '0.5rem',
  height: '0.5rem',
  borderRadius: '50%',
  background: '#d4d4d4',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  transition: 'background 150ms, width 150ms',
  selectors: {
    '&[data-active]': { background: '#111', width: '1.25rem', borderRadius: '999px' },
  },
});
