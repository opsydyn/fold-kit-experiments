import { globalStyle, style } from '@vanilla-extract/css';

globalStyle('*, *::before, *::after', {
  boxSizing: 'border-box',
  margin: 0,
  padding: 0,
});

globalStyle('body', {
  transition: 'background 180ms, color 180ms',
  background: 'var(--page-bg, #0a0a14)',
  minHeight: '100vh',
  color: 'var(--page-text, #e8e8ff)',
  fontFamily: 'system-ui, sans-serif',
});

export const nav = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  transition: 'background 180ms, border-color 180ms',
  borderBottom: '1px solid var(--nav-border, #1a1a2e)',
  background: 'var(--nav-bg, #0d0d1e)',
  padding: '0.75rem 1.5rem',
});

export const navLink = style({
  transition: 'background 120ms, color 120ms',
  borderRadius: '6px',
  padding: '0.375rem 0.75rem',
  textDecoration: 'none',
  color: 'var(--nav-text, #a0a0c0)',
  fontSize: '0.875rem',
  fontWeight: 500,
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
  marginBottom: '1.5rem',
  color: 'var(--page-text, #e8e8ff)',
  fontSize: '1.5rem',
  fontWeight: 700,
});

export const themeToggle = style({
  display: 'grid',
  placeItems: 'center',
  transition: 'background 120ms, color 120ms, border-color 120ms',
  marginInlineStart: 'auto',
  border: '1px solid var(--toggle-border, #2a2a3e)',
  borderRadius: '6px',
  background: 'transparent',
  cursor: 'pointer',
  width: '2rem',
  height: '2rem',
  color: 'var(--toggle-text, #a0a0c0)',
  fontSize: '1rem',
  selectors: {
    '&:hover': {
      background: 'var(--toggle-hover-bg, #1a1a2e)',
      color: 'var(--toggle-hover-text, #e8e8ff)',
    },
  },
});
