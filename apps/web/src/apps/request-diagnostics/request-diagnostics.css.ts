import { style } from '@vanilla-extract/css';

export const root = style({
  display: 'grid',
  gap: '1rem',
  maxWidth: '68rem',
});

export const toolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
});

export const button = style({
  border: '1px solid #334155',
  borderRadius: '4px',
  background: '#0f172a',
  color: '#e2e8f0',
  cursor: 'pointer',
  padding: '0.5rem 0.75rem',
});

export const status = style({
  color: '#94a3b8',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.8rem',
});

export const charts = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))',
  gap: '1rem',
});

export const panel = style({
  border: '1px solid #1e293b',
  borderRadius: '6px',
  background: '#0f172a',
  padding: '0.75rem',
});

export const label = style({
  display: 'block',
  marginBottom: '0.5rem',
  color: '#cbd5e1',
  fontSize: '0.8rem',
  fontWeight: 600,
});
