import { style } from '@vanilla-extract/css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
});

export const card = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3rem',
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '16px',
  padding: '2rem',
  maxWidth: '520px',
  width: '100%',
  '@media': {
    '(max-width: 480px)': {
      flexDirection: 'column',
      gap: '1.5rem',
    },
  },
});

export const chartWrapper = style({
  flexShrink: 0,
  width: '200px',
  selectors: {
    '& svg:focus-visible': {
      outline: '2px solid #6366f1',
      outlineOffset: '4px',
      borderRadius: '50%',
    },
  },
});

export const legend = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  flex: 1,
  minWidth: 0,
});

export const legendRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  cursor: 'default',
  selectors: {
    '&[data-active]': { fontWeight: 600 },
  },
});

export const swatch = style({
  width: '10px',
  height: '10px',
  borderRadius: '2px',
  flexShrink: 0,
});

export const legendLabel = style({
  fontSize: '0.875rem',
  color: '#111',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const legendValue = style({
  fontSize: '0.875rem',
  color: '#888',
  fontVariantNumeric: 'tabular-nums',
});
