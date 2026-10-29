/**
 * The full pages' colours, taken from the 3D radar's themes so the two agree: Night by
 * default, Paper for a light colour scheme and High contrast when more contrast is asked
 * for, as the radar's Auto theme picks. Pure: the layout writes the result into a style.
 *
 * @module
 */
import { lighten } from './three/colours';
import { categoryIds, relationshipTypes } from './three/data';
import { css, type Theme, themes, type Tokens } from './three/themes';

/** `colour` mixed `amount` of the way towards black. */
const darken = (colour: number, amount: number): number =>
  [16, 8, 0].reduce(
    (mixed, shift) => mixed | (Math.round(((colour >> shift) & 0xff) * (1 - amount)) << shift),
    0,
  );

/**
 * Links: the accent, lifted towards white on a dark page and deepened on a light one, so
 * it reads as text (4.5:1) on both.
 */
const linkOf = (tokens: Tokens): number =>
  tokens.scheme === 'dark' ? lighten(tokens.accent, 0.45) : darken(tokens.accent, 0.25);

/** A theme's custom properties, as CSS declarations. */
export const declarations = (theme: Theme): string => {
  const tokens: Tokens = themes[theme];
  const properties: ReadonlyArray<readonly [string, string]> = [
    ['color-scheme', tokens.scheme],
    ['--page', css(tokens.page)],
    ['--surface', css(tokens.panel)],
    ['--border', css(tokens.border)],
    ['--text', css(tokens.ink)],
    ['--muted', css(tokens.muted)],
    ['--accent', css(linkOf(tokens))],
    ...categoryIds.map((id) => [`--category-${id}`, css(tokens.categories[id])] as const),
    ...relationshipTypes.map(
      (type) => [`--relationship-${type}`, css(tokens.relationships[type])] as const,
    ),
  ];
  return properties.map(([name, value]) => `${name}: ${value};`).join(' ');
};

/** The pages' stylesheet of colours: Night, Paper when light, High contrast when asked. */
export const pageThemeCss = [
  `:root { ${declarations('night')} }`,
  `@media (prefers-color-scheme: light) { :root { ${declarations('paper')} } }`,
  `@media (prefers-contrast: more) { :root { ${declarations('contrast')} } }`,
].join('\n');
