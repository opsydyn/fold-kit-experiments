import { globalStyle, keyframes, style } from '@vanilla-extract/css';

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const palette = {
  critical: 'var(--field-critical, #e8727a)',
  caution: 'var(--field-caution, #d9b45b)',
  ready: 'var(--field-ready, #6fbf8e)',
  tertiary: 'var(--field-tertiary, #8a94a6)',
  primary: 'var(--field-primary, #6aa7e8)',
  surface: 'var(--field-surface, #0d1412)',
  text: 'var(--field-text, #e6efe9)',
} as const;

export const card = style({
  display: 'grid',
  gap: '0.75rem',
  border: '1px solid var(--field-border, #2a3a34)',
  background: palette.surface,
  padding: '1.25rem',
  maxWidth: '420px',
  width: '100%',
  color: palette.text,
  fontFamily: mono,
});

export const title = style({
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontSize: '0.95rem',
});

export const meta = style({ textTransform: 'uppercase', fontSize: '0.75rem', opacity: 0.85 });

export const canvas = style({
  display: 'grid',
  justifyItems: 'center',
  gap: '0.5rem',
  border: '1px solid var(--field-border, #2a3a34)',
  padding: '0.75rem',
});

export const readout = style({
  justifySelf: 'stretch',
  minHeight: '2.5em',
  fontSize: '0.7rem',
  letterSpacing: '0.04em',
});

export const standby = style({ opacity: 0.5 });

export const warning = style({
  border: `1px solid ${palette.critical}`,
  padding: '0.4rem 0.6rem',
  color: palette.critical,
  fontSize: '0.7rem',
});

export const tiles = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
  gap: '0.5rem',
  margin: 0,
});

export const tile = style({
  border: '1px solid var(--field-border, #2a3a34)',
  padding: '0.5rem 0.75rem',
});

export const tileLabel = style({
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.65rem',
  opacity: 0.8,
});

export const tileValue = style({ margin: 0, fontSize: '1rem', fontWeight: 700 });

export const legend = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 1rem',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: '0.7rem',
});

export const tableToggle = style({ fontSize: '0.75rem' });

globalStyle(`${tableToggle} table`, {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '0.5rem',
});
globalStyle(`${tableToggle} th, ${tableToggle} td`, {
  borderBottom: '1px solid var(--field-border, #2a3a34)',
  padding: '0.2rem 0.4rem',
  textAlign: 'left',
});

const pulse = keyframes({
  '0%, 100%': { transform: 'scale(1)', opacity: 0.45 },
  '50%': { transform: 'scale(1.04)', opacity: 0.15 },
});

globalStyle(`${canvas} .chart-orbit-pulse`, {
  transformBox: 'fill-box',
  transformOrigin: 'center',
  animation: `${pulse} 6s ease-in-out infinite`,
  '@media': { '(prefers-reduced-motion: reduce)': { animation: 'none' } },
});

globalStyle(`${canvas} .chart-orbit-mark:focus-visible`, {
  outline: `2px solid ${palette.primary}`,
  outlineOffset: '2px',
});
