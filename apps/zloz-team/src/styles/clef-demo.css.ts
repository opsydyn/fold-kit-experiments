import { globalStyle, style } from '@vanilla-extract/css';

export const demo = style({ overflowWrap: 'anywhere' });
export const relationship = style({
  border: '1px solid var(--rule)',
  padding: '10px 12px',
  color: 'var(--ink)',
  background: 'var(--panel)',
});
export const score = style({
  color: 'var(--accent)',
  fontSize: '1.125rem',
  fontVariantNumeric: 'tabular-nums',
});

globalStyle(`${demo} article`, {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'baseline',
  gap: '6px 12px',
  borderBlockStart: '1px solid var(--rule)',
  paddingBlock: '14px',
});
globalStyle(`${demo} article h3, ${demo} article p`, { margin: 0 });
globalStyle(`${demo} article p, ${demo} meter, ${demo} details`, { gridColumn: '1 / -1' });
globalStyle(`${demo} meter`, { appearance: 'none', width: '100%', height: 10 });
globalStyle(`${demo} meter::-webkit-meter-bar`, {
  border: 0,
  borderRadius: 0,
  background: 'var(--raised)',
});
globalStyle(`${demo} meter::-webkit-meter-optimum-value`, { background: 'var(--accent)' });
globalStyle(`${demo} meter::-moz-meter-bar`, { background: 'var(--accent)' });
globalStyle(`${demo} summary`, { width: 'fit-content', color: 'var(--accent)' });
globalStyle(`${demo} summary:focus-visible`, {
  outline: '3px solid var(--accent)',
  outlineOffset: 3,
});
globalStyle(`${demo} details p, ${demo} details li`, { marginBlock: 8 });
