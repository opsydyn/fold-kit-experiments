import { globalStyle, style } from '@vanilla-extract/css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
});

globalStyle('body', {
  fontFamily: 'system-ui, sans-serif',
  background: 'var(--page-bg, #0a0a14)',
  color: 'var(--page-text, #e8e8ff)',
  minHeight: '100vh',
  transition: 'background 180ms, color 180ms',
});

export const nav = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.75rem 1.5rem',
  background: 'var(--nav-bg, #0d0d1e)',
  borderBottom: '1px solid var(--nav-border, #1a1a2e)',
  transition: 'background 180ms, border-color 180ms',
});

export const navLink = style({
  padding: '0.375rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: 500,
  textDecoration: 'none',
  color: 'var(--nav-text, #a0a0c0)',
  transition: 'background 120ms, color 120ms',
  selectors: {
    '&:hover': {
      background: 'var(--nav-text-hover-bg, #1a1a2e)',
      color: 'var(--nav-text-hover, #e8e8ff)',
    },
  },
});

export const navLinkActive = style({
  background: 'var(--nav-active-bg, #e8e8ff)',
  color: 'var(--nav-active-text, #0a0a14)',
  selectors: {
    '&:hover': {
      background: 'var(--nav-active-bg, #e8e8ff)',
      color: 'var(--nav-active-text, #0a0a14)',
    },
  },
});

export const main = style({
  padding: '2rem 1.5rem',
});

export const heading = style({
  fontSize: '1.5rem',
  fontWeight: 700,
  marginBottom: '1.5rem',
  color: 'var(--page-text, #e8e8ff)',
});

export const themeToggle = style({
  marginInlineStart: 'auto',
  display: 'grid',
  placeItems: 'center',
  width: '2rem',
  height: '2rem',
  border: '1px solid var(--toggle-border, #2a2a3e)',
  borderRadius: '6px',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '1rem',
  color: 'var(--toggle-text, #a0a0c0)',
  transition: 'background 120ms, color 120ms, border-color 120ms',
  selectors: {
    '&:hover': {
      background: 'var(--toggle-hover-bg, #1a1a2e)',
      color: 'var(--toggle-hover-text, #e8e8ff)',
    },
  },
});
