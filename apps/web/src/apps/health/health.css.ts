import { keyframes, style } from '@vanilla-extract/css';

const shimmer = keyframes({
  '0%': { backgroundPosition: '-200% 0' },
  '100%': { backgroundPosition: '200% 0' },
});

const skeletonBase = {
  borderRadius: '4px',
  background: 'linear-gradient(90deg, #e5e5e5 25%, #f0f0f0 50%, #e5e5e5 75%)',
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.4s infinite linear`,
};

export const cardValueError = style({
  color: '#dc2626',
});

export const skeletonLabel = style({
  ...skeletonBase,
  marginBottom: '0.5rem',
  width: '42%',
  height: '11px',
});
export const skeletonValueLg = style({
  ...skeletonBase,
  width: '52%',
  height: '2rem',
});
export const skeletonValueMd = style({
  ...skeletonBase,
  width: '72%',
  height: '1rem',
});
export const skeletonSub = style({
  ...skeletonBase,
  marginTop: '0.3rem',
  width: '58%',
  height: '10px',
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '1rem',
  maxWidth: '700px',
});

export const card = style({
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  background: '#fff',
  padding: '1.25rem 1.5rem',
});

export const cardLabel = style({
  marginBottom: '0.4rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888',
  fontSize: '0.75rem',
  fontWeight: 600,
});

export const cardValue = style({
  color: '#111',
  fontSize: '1.5rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
});

export const cardValueOk = style({
  color: '#16a34a',
});

export const cardValueSmall = style({
  fontSize: '1rem',
});

export const cardSub = style({
  marginTop: '0.25rem',
  color: '#888',
  fontSize: '0.8rem',
});
