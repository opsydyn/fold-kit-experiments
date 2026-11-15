import { globalStyle, style } from '@vanilla-extract/css';

export const palette = {
  surface: 'var(--ds-surface, #0f1419)',
  text: 'var(--ds-text, #e6edf3)',
  muted: 'var(--ds-muted, #9aa7b4)',
  border: 'var(--ds-border, #26313b)',
  grid: 'var(--ds-grid, #1b242c)',
  line: 'var(--ds-line, #6aa7e8)',
  accent: 'var(--ds-accent, #e8a33c)',
  point: 'var(--ds-point, #8fb8de)',
} as const;

export const page = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 460px), 1fr))',
  gap: '1rem',
});

export const panel = style({
  display: 'grid',
  gap: '0.5rem',
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  padding: '1rem',
  color: palette.text,
  minWidth: 0,
});

export const title = style({ fontSize: '1rem', fontWeight: 600, margin: 0 });

export const note = style({ margin: 0, fontSize: '0.8rem', color: palette.muted });

export const controls = style({ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' });

export const toggle = style({
  border: `1px solid ${palette.border}`,
  background: 'transparent',
  padding: '0.2rem 0.6rem',
  color: palette.muted,
  font: 'inherit',
  fontSize: '0.75rem',
  cursor: 'pointer',
  selectors: {
    '&[aria-pressed="true"]': { borderColor: palette.text, color: palette.text },
    '&:focus-visible': { outline: `2px solid ${palette.line}`, outlineOffset: '2px' },
  },
});

export const table = style({ fontSize: '0.75rem' });

globalStyle(`${table} table`, { borderCollapse: 'collapse', marginTop: '0.25rem' });
globalStyle(`${table} th, ${table} td`, {
  borderBottom: `1px solid ${palette.border}`,
  padding: '0.15rem 0.5rem',
  textAlign: 'left',
});
