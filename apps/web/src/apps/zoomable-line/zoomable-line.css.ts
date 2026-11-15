import { style } from '@vanilla-extract/css';

export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem',
  marginBottom: '0.35rem',
});

export const button = style({
  border: '1px solid var(--card-border, #2a2a40)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.15rem 0.55rem',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.75rem',
  selectors: { '&:focus-visible': { outline: '2px solid #6366f1', outlineOffset: '2px' } },
});
