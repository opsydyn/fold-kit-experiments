import { globalStyle } from '@vanilla-extract/css';

globalStyle('.team-context, .board-actions, .board-pages', {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
});
globalStyle('nav.team-context', { justifyContent: 'space-between' });
globalStyle('.team-context .settings-link', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});
globalStyle('.settings-link svg', { width: 16, height: 16, fill: 'currentColor' });
globalStyle('.board-directory', { marginTop: 24, paddingTop: 0, border: 0 });
globalStyle('.directory-header, .board-search', {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
});
globalStyle('.directory-header', { justifyContent: 'space-between', marginBottom: 18 });
globalStyle('.directory-header h2, #new-board-heading', { margin: 0 });
globalStyle('.board-actions .primary', {
  background: 'var(--accent)',
  color: 'var(--control-ink)',
});
globalStyle('.board-actions button.primary:hover:not(:disabled)', {
  background: 'var(--ink)',
  color: 'var(--paper)',
});
globalStyle('.board-actions a.button-link', { textDecoration: 'none' });
globalStyle('.board-directory svg', { width: 18, height: 18, flexShrink: 0, fill: 'currentColor' });
globalStyle('.board-search label', {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  paddingInline: 12,
  border: '1px solid var(--team-control-rule)',
  background: 'var(--panel)',
  color: 'var(--muted)',
  width: 'min(25rem, 100%)',
});
globalStyle('.board-search input', {
  background: 'transparent',
  border: 0,
  width: '100%',
  minWidth: 0,
  minHeight: 42,
});
globalStyle('.board-search label:focus-within', { outline: '2px solid var(--accent)' });
globalStyle('.board-list', { listStyle: 'none', margin: 0, padding: 0 });
globalStyle('.board-list li, .board-list-heading', {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 14,
  paddingInline: 12,
  borderBottom: '1px solid var(--rule)',
});
globalStyle('.board-list-heading', {
  marginTop: 22,
  paddingBlock: 8,
  fontSize: 12,
  color: 'var(--muted)',
});
globalStyle('.board-list li:focus-within, .board-list li:hover', { background: 'var(--panel)' });
globalStyle('.board-list a', {
  display: 'flex',
  alignItems: 'center',
  minHeight: 48,
  gap: 12,
  color: 'var(--ink)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
});
globalStyle('.board-list svg', { color: 'var(--accent)' });
globalStyle('.board-list time, .board-pages, .board-access', {
  fontSize: 13,
  color: 'var(--muted)',
  fontVariantNumeric: 'tabular-nums',
});
globalStyle('.board-empty', { paddingBlock: 24 });
globalStyle('.board-pages', { marginBlock: 16 });
globalStyle('#new-board', {
  width: 'min(24rem, calc(100% - 2rem))',
  padding: 24,
  background: 'var(--panel)',
  color: 'var(--ink)',
  border: '1px solid var(--team-control-rule)',
  boxShadow: '0 10px 34px rgb(0 0 0 / 22%)',
});
globalStyle('#new-board::backdrop', { background: 'rgb(0 0 0 / 25%)' });
globalStyle('.new-board-form, .new-board-form label', { display: 'grid', gap: 6 });
globalStyle('.new-board-form', { maxWidth: '32rem', gap: 16, marginTop: 16 });
globalStyle('.new-board-form :is(input, select)', {
  width: '100%',
  minHeight: 44,
  paddingInline: 10,
  background: 'var(--paper)',
  border: '1px solid var(--team-control-rule)',
});
