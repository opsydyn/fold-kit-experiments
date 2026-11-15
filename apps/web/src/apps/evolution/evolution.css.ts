import { globalStyle, style } from '@vanilla-extract/css';

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const palette = {
  person: 'var(--evolution-person, #6aa7e8)',
  system: 'var(--evolution-system, #6fbf8e)',
  externalSystem: 'var(--evolution-external, #8a94a6)',
  container: 'var(--evolution-container, #e892c4)',
  component: 'var(--evolution-component, #d9b45b)',
  edges: 'var(--evolution-edges, #e8727a)',
  surface: 'var(--evolution-surface, #0d1412)',
  text: 'var(--evolution-text, #e6efe9)',
  muted: 'var(--evolution-muted, #8fa39a)',
  border: 'var(--evolution-border, #2a3a34)',
} as const;

export const card = style({
  display: 'grid',
  gap: '0.75rem',
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  padding: '1.25rem',
  maxWidth: '480px',
  width: '100%',
  color: palette.text,
  fontFamily: mono,
});

export const title = style({
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontSize: '0.95rem',
});

export const meta = style({ fontSize: '0.75rem', letterSpacing: '0.04em', opacity: 0.85 });

export const canvas = style({ border: `1px solid ${palette.border}`, padding: '0.5rem' });

export const controls = style({ display: 'flex', gap: '0.5rem', fontSize: '0.7rem' });

export const toggle = style({
  border: `1px solid ${palette.border}`,
  background: 'transparent',
  padding: '0.2rem 0.6rem',
  color: palette.muted,
  font: 'inherit',
  cursor: 'pointer',
  selectors: {
    '&[aria-pressed="true"]': { borderColor: palette.text, color: palette.text },
    '&:focus-visible': { outline: `2px solid ${palette.person}`, outlineOffset: '2px' },
  },
});

export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 0.5rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: '0.7rem',
});

export const legendButton = style([
  toggle,
  { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: palette.text },
]);

export const swatch = style({ width: '0.6rem', height: '0.6rem', borderRadius: '50%' });

export const tableToggle = style({ fontSize: '0.75rem' });

globalStyle(`${tableToggle} table`, {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '0.5rem',
});
globalStyle(`${tableToggle} th, ${tableToggle} td`, {
  borderBottom: `1px solid ${palette.border}`,
  padding: '0.2rem 0.4rem',
  textAlign: 'left',
});
