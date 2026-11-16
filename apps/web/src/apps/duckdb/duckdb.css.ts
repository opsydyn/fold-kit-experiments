import { style } from '@vanilla-extract/css';

export const page = style({ display: 'grid', gap: '0.75rem', maxWidth: '760px' });

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
  selectors: {
    '&[aria-pressed="true"]': { background: 'var(--ex-border, #26313b)' },
    '&:focus-visible': { outline: '2px solid #6aa7e8', outlineOffset: '2px' },
    '&:disabled': { cursor: 'progress', opacity: 0.6 },
  },
});

export const label = style({ fontSize: '0.8rem', opacity: 0.75 });

export const readout = style({
  margin: 0,
  minHeight: '1.4em',
  fontSize: '0.85rem',
  fontVariantNumeric: 'tabular-nums',
});

export const surface = style({
  border: '1px solid var(--ex-border, #26313b)',
  background: 'var(--ex-surface, #0f1419)',
  padding: '0.75rem',
});

export const sql = style({
  fontSize: '0.75rem',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  margin: '0.5rem 0 0',
});
