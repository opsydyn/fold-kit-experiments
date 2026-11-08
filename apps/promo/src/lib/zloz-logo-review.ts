/** Trusted, repository-authored SVG only. This is not a sanitizer for external content. */
export function decorativeLogo(source: string): string {
  return source
    .replace(/role="img"/u, '')
    .replace(/aria-label="[^"]*"/u, '')
    .replace(/<title>[\s\S]*?<\/title>/u, '')
    .replace('<svg', '<svg aria-hidden="true" focusable="false"');
}

/** Match the live Brand components' CSS-variable fills using their existing favicon geometry. */
export function familyLogo(source: string): string {
  return decorativeLogo(source)
    .replaceAll('#3e7bfa', 'var(--blue, #3d79fa)')
    .replaceAll('#ffcf60', 'var(--gold, #f5ce60)')
    .replaceAll('#ff8b7b', 'var(--coral, #fa8b79)')
    .replaceAll('#a9c0ff', 'var(--periwinkle, #b3c9fc)');
}
