export type Theme = 'light' | 'dark';

export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  switch (saved) {
    case 'light':
    case 'dark':
      return saved;
    default:
      return prefersDark ? 'dark' : 'light';
  }
}
