import { globalStyle, style } from '@vanilla-extract/css';

export const page = style({ display: 'grid', gap: '1.25rem', maxWidth: '760px' });

export const example = style({
  display: 'grid',
  gap: '0.5rem',
  border: '1px solid var(--pg-border, #26313b)',
  background: 'var(--pg-surface, #0f1419)',
  padding: '1rem',
  color: 'var(--pg-text, #e6edf3)',
  minWidth: 0,
});

export const title = style({ margin: 0, fontSize: '1rem', fontWeight: 600 });

export const note = style({ margin: 0, fontSize: '0.8rem', opacity: 0.75 });

export const spec = style({ fontSize: '0.72rem' });

globalStyle(`${spec} pre`, {
  maxHeight: '18rem',
  overflow: 'auto',
  margin: '0.5rem 0 0',
  padding: '0.5rem',
  background: 'var(--pg-code, #0a0e12)',
});
