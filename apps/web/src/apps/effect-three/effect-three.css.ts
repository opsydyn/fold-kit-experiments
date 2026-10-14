import { style } from '@vanilla-extract/css';

export const scene = style({
  display: 'block',
  borderRadius: '12px',
  background: '#0b0b14',
  cursor: 'pointer',
  width: '100%',
  height: '360px',
  overflow: 'hidden',
});

export const placeholder = style([
  scene,
  { display: 'grid', placeItems: 'center', cursor: 'default', color: '#8a8aa3' },
]);

export const controls = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '1rem',
});

export const status = style({ marginTop: '0.75rem', color: '#8a8aa3', fontSize: '0.875rem' });
