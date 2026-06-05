import { globalStyle, style } from '@vanilla-extract/css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
});

export const layout = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3rem',
  width: '100%',
  '@media': {
    '(max-width: 480px)': {
      flexDirection: 'column',
      gap: '1.5rem',
    },
  },
});

export const card = style([
  layout,
  {
    background: 'var(--card-bg, #12121f)',
    border: '1px solid var(--card-border, #1e1e33)',
    transition: 'background 180ms, border-color 180ms',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '520px',
  },
]);

export const chartWrapper = style({
  flexShrink: 0,
  width: '200px',
});

globalStyle(`${chartWrapper} svg:focus-visible`, {
  outline: '2px solid #6366f1',
  outlineOffset: '4px',
  borderRadius: '50%',
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
  color: 'var(--page-text, #e8e8ff)',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const legendValue = style({
  fontSize: '0.875rem',
  color: 'var(--chart-label, #888)',
  fontVariantNumeric: 'tabular-nums',
});
