import { style } from '@vanilla-extract/css';

export const page = style({ display: 'grid', gap: '0.6rem', maxWidth: '860px' });

export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
});

export const button = style({
  border: '1px solid var(--card-border, #2a2a40)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.2rem 0.65rem',
  color: 'inherit',
  font: 'inherit',
  selectors: { '&:focus-visible': { outline: '2px solid #6366f1', outlineOffset: '2px' } },
});

export const charts = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '1rem',
});

export const brushable = style({ cursor: 'crosshair', touchAction: 'none', userSelect: 'none' });
