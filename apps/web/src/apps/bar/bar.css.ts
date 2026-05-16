import { globalStyle, style } from '@vanilla-extract/css';

export const page = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
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
