import { globalStyle, style } from '@vanilla-extract/css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

export const card = style({
  background: 'var(--card-bg, #12121f)',
  border: '1px solid var(--card-border, #1e1e33)',
  transition: 'background 180ms, border-color 180ms',
  borderRadius: '16px',
  padding: '1.5rem',
  width: '100%',
  maxWidth: '560px',
});

globalStyle(`${card} svg:focus-visible`, {
  outline: '2px solid #6366f1',
  outlineOffset: '4px',
  borderRadius: '8px',
});
