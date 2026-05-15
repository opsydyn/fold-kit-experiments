import { globalStyle, style } from '@vanilla-extract/css'

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
})

globalStyle('body', {
  fontFamily: 'system-ui, sans-serif',
  background: '#fafafa',
  color: '#111',
  minHeight: '100vh',
})

export const nav = style({
  display: 'flex',
  gap: '0.25rem',
  padding: '0.75rem 1.5rem',
  background: '#fff',
  borderBottom: '1px solid #e5e5e5',
})

export const navLink = style({
  padding: '0.375rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: 500,
  textDecoration: 'none',
  color: '#555',
  transition: 'background 120ms, color 120ms',
  selectors: {
    '&:hover': { background: '#f0f0f0', color: '#111' },
  },
})

export const navLinkActive = style({
  background: '#111',
  color: '#fff',
  selectors: {
    '&:hover': { background: '#333', color: '#fff' },
  },
})

export const main = style({
  padding: '2rem 1.5rem',
})

export const heading = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '1.5rem',
})
