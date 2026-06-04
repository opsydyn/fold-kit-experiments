import { persistentAtom } from '@nanostores/persistent';

export type Theme = 'light' | 'dark';

export const themeAtom = persistentAtom<Theme>('foldkit-theme', 'dark');

/** Apply the theme to <html data-theme="..."> and keep it in sync. */
export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}
