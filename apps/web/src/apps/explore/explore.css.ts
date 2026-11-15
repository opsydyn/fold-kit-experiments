import { style } from '@vanilla-extract/css';

export const page = style({
  display: 'grid',
  gap: '0.75rem',
  maxWidth: '760px',
  color: 'var(--page-text, #e6edf3)',
});

export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
});

export const button = style({
  border: '1px solid var(--ex-border, #26313b)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0.25rem 0.75rem',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.8rem',
  selectors: { '&:focus-visible': { outline: '2px solid #6aa7e8', outlineOffset: '2px' } },
});

export const status = style({ opacity: 0.75, fontSize: '0.8rem' });

export const readout = style({
  margin: 0,
  minHeight: '1.4em',
  fontSize: '0.85rem',
  fontVariantNumeric: 'tabular-nums',
});

export const surface = style({
  border: '1px solid var(--ex-border, #26313b)',
  background: 'var(--ex-surface, #0f1419)',
  cursor: 'crosshair',
  touchAction: 'none',
  padding: '0.75rem',
  userSelect: 'none',
});
