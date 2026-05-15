import { style } from '@vanilla-extract/css'

export const heading = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '1.5rem',
})

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '1rem',
  maxWidth: '700px',
})

export const card = style({
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
})

export const cardLabel = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#888',
  marginBottom: '0.4rem',
})

export const cardValue = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#111',
  fontVariantNumeric: 'tabular-nums',
})

export const cardValueOk = style({
  color: '#16a34a',
})

export const cardValueSmall = style({
  fontSize: '1rem',
})

export const cardSub = style({
  fontSize: '0.8rem',
  color: '#888',
  marginTop: '0.25rem',
})
