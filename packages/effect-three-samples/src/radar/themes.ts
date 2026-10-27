/**
 * The radar's themes: Night (the default sky), Blueprint (a cyanotype drawing), Paper (ink
 * on white), High contrast, and two deep-space themes after a dying star seen from orbit:
 * Paragon (cool blue light on navy) and Renegade (an ember star with a blue rim on dark
 * maroon). Every colour the scene, the sidebar and the overlays use is
 * here, so the three always agree; nothing else hard-codes one. Pure.
 *
 * The category and relationship colours are slots of the dataviz reference palette,
 * validated with its `validate_palette.js` (all pairs) against each theme's own surface:
 *
 * - Categories, dark steps on Night, Blueprint and High contrast; light steps on Paper. No
 *   check fails. Yellow and green sit at protan ΔE 6.9, inside the 6–8 band that is legal
 *   with secondary encoding: every category also has its own body shape, label and legend
 *   chip. On Paper, yellow (1.95:1) and magenta (2.43:1), and on Blueprint, green (2.3:1)
 *   and magenta (2.89:1) are under 3:1 against the surface: relieved by the always-visible
 *   labels, legend and entries table.
 * - Relationships take three further slots, blue, orange and aqua, which pass on every
 *   surface (orange 2.93:1 on Blueprint, orange and aqua under 3:1 on Paper, relieved by
 *   the edge captions and legend). The two remaining types share the neutral ink and are
 *   told apart by their line style, dashed or dotted, and their captions.
 * - Paragon (#0a1433) and Renegade (#1a0b14) take the dark steps and pass on their surface.
 *   At the brightest point of their star glow (30% of the glow over the surface: #192f64
 *   and #5b2a16), green (2.6:1, 2.38:1) and on Renegade magenta (2.98:1) fall under 3:1,
 *   relieved as on Blueprint.
 */
import { Match, Schema } from 'effect';

import type { Category, RelationshipType } from './data';

export const Theme = Schema.Literals([
  'night',
  'blueprint',
  'paper',
  'contrast',
  'paragon',
  'renegade',
]);
export type Theme = typeof Theme.Type;

/** What the reader picked: a theme, or Auto, which follows their settings. */
export const ThemeChoice = Schema.Literals([
  'auto',
  'night',
  'blueprint',
  'paper',
  'contrast',
  'paragon',
  'renegade',
]);
export type ThemeChoice = typeof ThemeChoice.Type;

/** The reader's colour scheme and contrast settings, as the browser reports them. */
export const ColorScheme = Schema.Literals(['dark', 'light']);
export type ColorScheme = typeof ColorScheme.Type;
export const ContrastSetting = Schema.Literals(['standard', 'more']);
export type ContrastSetting = typeof ContrastSetting.Type;

/** What fills the far background: stars, a drafting grid, or nothing. */
export type Sky = 'stars' | 'grid' | 'none';

/** Whether a sky has stars to hide constellations among, and whether it has a grid. */
export const skies = {
  stars: { starry: true, ruled: false, deep: true },
  grid: { starry: false, ruled: true, deep: true },
  none: { starry: false, ruled: false, deep: false },
} as const satisfies Readonly<
  Record<Sky, Readonly<{ starry: boolean; ruled: boolean; deep: boolean }>>
>;

export type Tokens = Readonly<{
  /** Whether the theme is light or dark, for the browser's own form controls. */
  scheme: ColorScheme;
  /** The stage and the panels behind the controls. */
  surface: number;
  panel: number;
  /** The page behind everything, for the moment before the app paints. */
  page: number;
  /** Text and labels; muted text; borders. */
  ink: number;
  muted: number;
  border: number;
  /** Shells' equators, sector lines and ring names. */
  guide: number;
  /** The halo round label text, so it reads over whatever is behind it. */
  outline: number;
  /** How thick the halo round label text is: High contrast draws it bolder. */
  labelOutline: number;
  /** The outline round a category's name, set in its colour. */
  categoryOutline: number;
  /** The accent: focus rings, pressed buttons, the stage's soft glow. */
  accent: number;
  /** The stage's soft glow behind the radar; High contrast has none (its surface colour). */
  glow: number;
  /** How strongly the glow shows at its brightest, 0 to 1. */
  glowStrength: number;
  /** A second colour ringing the glow, as the blue rim round a dying star; and how strongly. */
  rim: number;
  rimStrength: number;
  /** How strongly the shells tint what is inside them; 0 leaves only their equators. */
  shellOpacity: number;
  sky: Sky;
  /** How much the distant dots, halos and rings lighten their category's colour. */
  lift: number;
  /** A factor on every edge's opacity: light surfaces need stronger lines. */
  edgeStrength: number;
  categories: Readonly<Record<Category, number>>;
  relationships: Readonly<Record<RelationshipType, number>>;
}>;

/** Category hues, by slot: techniques violet, tools green, platforms yellow, languages magenta. */
const darkCategories = {
  techniques: 0x9085e9,
  tools: 0x008300,
  platforms: 0xc98500,
  'languages-frameworks': 0xd55181,
} as const satisfies Readonly<Record<Category, number>>;

const lightCategories = {
  techniques: 0x6250d6,
  tools: 0x008300,
  platforms: 0xeda100,
  'languages-frameworks': 0xe87ba4,
} as const satisfies Readonly<Record<Category, number>>;

/** The dark-surface relationship colours, with the neutral for the last two types. */
const darkRelationships = (neutral: number) =>
  ({
    'builds-on': 0x3987e5,
    complements: 0xd95926,
    'inspired-by': 0x199e70,
    'guards-against': neutral,
    'alternative-to': neutral,
  }) as const satisfies Readonly<Record<RelationshipType, number>>;

export const themes = {
  night: {
    scheme: 'dark',
    surface: 0x12121f,
    panel: 0x0f0f1a,
    page: 0x0a0a14,
    ink: 0xe8e8f0,
    muted: 0x8a8aa3,
    border: 0x2a2a40,
    guide: 0x8a8aa3,
    outline: 0x12121f,
    labelOutline: 0.012,
    categoryOutline: 0xe8e8f0,
    accent: 0x3d79fa,
    glow: 0x3d79fa,
    glowStrength: 0.1,
    rim: 0x3d79fa,
    rimStrength: 0,
    shellOpacity: 0.07,
    sky: 'stars',
    lift: 1,
    edgeStrength: 1,
    categories: darkCategories,
    relationships: darkRelationships(0xc3c2b7),
  },
  blueprint: {
    scheme: 'dark',
    surface: 0x123a6b,
    panel: 0x0f3260,
    page: 0x0d2c55,
    ink: 0xf2f6fc,
    muted: 0xa9c1e2,
    border: 0x3a64a0,
    guide: 0xc6d8f0,
    outline: 0x123a6b,
    labelOutline: 0.012,
    categoryOutline: 0xf2f6fc,
    accent: 0xf2f6fc,
    glow: 0x3a64a0,
    glowStrength: 0.1,
    rim: 0x3a64a0,
    rimStrength: 0,
    shellOpacity: 0.06,
    sky: 'grid',
    lift: 1,
    edgeStrength: 1.3,
    categories: darkCategories,
    relationships: darkRelationships(0xd6e2f2),
  },
  paper: {
    scheme: 'light',
    surface: 0xf6f3ea,
    panel: 0xefebe0,
    page: 0xf6f3ea,
    ink: 0x1d1c1a,
    muted: 0x52514e,
    border: 0xd6d2c4,
    guide: 0x8a877d,
    outline: 0xf6f3ea,
    labelOutline: 0.01,
    categoryOutline: 0xf6f3ea,
    accent: 0x2a78d6,
    glow: 0xd6d2c4,
    glowStrength: 0.1,
    rim: 0xd6d2c4,
    rimStrength: 0,
    shellOpacity: 0.045,
    sky: 'none',
    lift: 0,
    edgeStrength: 1.8,
    categories: lightCategories,
    relationships: {
      'builds-on': 0x2a78d6,
      complements: 0xeb6834,
      'inspired-by': 0x1baf7a,
      'guards-against': 0x52514e,
      'alternative-to': 0x52514e,
    },
  },
  contrast: {
    scheme: 'dark',
    surface: 0x000000,
    panel: 0x000000,
    page: 0x000000,
    ink: 0xffffff,
    muted: 0xd6d6d6,
    border: 0xffffff,
    guide: 0xffffff,
    outline: 0x000000,
    labelOutline: 0.03,
    categoryOutline: 0xffffff,
    accent: 0xffff00,
    glow: 0x000000,
    glowStrength: 0,
    rim: 0x000000,
    rimStrength: 0,
    shellOpacity: 0,
    sky: 'none',
    lift: 0.4,
    edgeStrength: 2,
    categories: darkCategories,
    relationships: darkRelationships(0xd6d6d6),
  },
  paragon: {
    scheme: 'dark',
    surface: 0x0a1433,
    panel: 0x08102a,
    page: 0x060c22,
    ink: 0xe8f1ff,
    muted: 0x8fa4c8,
    border: 0x24376b,
    guide: 0x8fb4e6,
    outline: 0x0a1433,
    labelOutline: 0.012,
    categoryOutline: 0xe8f1ff,
    accent: 0x4fa3ff,
    glow: 0x3d6fd6,
    glowStrength: 0.3,
    rim: 0x9fd8ff,
    rimStrength: 0.08,
    shellOpacity: 0.08,
    sky: 'stars',
    lift: 1,
    edgeStrength: 1.1,
    categories: darkCategories,
    relationships: darkRelationships(0xc3cde0),
  },
  renegade: {
    scheme: 'dark',
    surface: 0x1a0b14,
    panel: 0x14080f,
    page: 0x10060c,
    ink: 0xfbeee6,
    muted: 0xc49a8c,
    border: 0x4a2230,
    guide: 0xd9a08a,
    outline: 0x1a0b14,
    labelOutline: 0.012,
    categoryOutline: 0xfbeee6,
    accent: 0xe8452c,
    glow: 0xf2711c,
    glowStrength: 0.3,
    rim: 0x3d6fd6,
    rimStrength: 0.14,
    shellOpacity: 0.07,
    sky: 'stars',
    lift: 1,
    edgeStrength: 1.1,
    categories: darkCategories,
    relationships: darkRelationships(0xe0c7bd),
  },
} as const satisfies Readonly<Record<Theme, Tokens>>;

/** The reader's settings, as the theme's Auto choice reads them. */
export type ThemeSettings = Readonly<{ scheme: ColorScheme; contrast: ContrastSetting }>;

/**
 * The theme in force. A choice wins; Auto follows the reader's settings: more contrast
 * asked for, High contrast; a light scheme, Paper; otherwise Night.
 */
export const resolveTheme = (choice: ThemeChoice, settings: ThemeSettings): Theme =>
  Match.value(choice).pipe(
    Match.when('auto', () => autoTheme(settings)),
    Match.orElse((chosen) => chosen),
  );

/** What Auto picks: more contrast asked for, High contrast; light, Paper; else Night. */
const autoTheme = (settings: ThemeSettings): Theme =>
  Match.value(settings).pipe(
    Match.when({ contrast: 'more' }, (): Theme => 'contrast'),
    Match.when({ scheme: 'light' }, (): Theme => 'paper'),
    Match.orElse((): Theme => 'night'),
  );

/** A share as a CSS percentage. */
const percent = (share: number): string => `${Math.round(share * 100)}%`;

/** A colour as CSS. */
export const css = (colour: number): string => `#${colour.toString(16).padStart(6, '0')}`;

/** The custom properties the sidebar, overlays and minimap read. */
export type CssVariables = Readonly<{
  '--surface': string;
  '--panel': string;
  '--page': string;
  '--text': string;
  '--muted': string;
  '--border': string;
  '--blue': string;
  '--glow': string;
  '--glow-strength': string;
  '--rim': string;
  '--rim-strength': string;
  'color-scheme': ColorScheme;
}>;

/** A theme's custom properties, and the colour scheme its form controls take. */
export const cssVariables = (theme: Theme): CssVariables => {
  const tokens: Tokens = themes[theme];
  return {
    '--surface': css(tokens.surface),
    '--panel': css(tokens.panel),
    '--page': css(tokens.page),
    '--text': css(tokens.ink),
    '--muted': css(tokens.muted),
    '--border': css(tokens.border),
    '--blue': css(tokens.accent),
    '--glow': css(tokens.glow),
    '--glow-strength': percent(tokens.glowStrength),
    '--rim': css(tokens.rim),
    '--rim-strength': percent(tokens.rimStrength),
    'color-scheme': tokens.scheme,
  };
};

/** What each choice is called in the picker. */
export const themeLabels = {
  auto: 'Auto',
  night: 'Night',
  blueprint: 'Blueprint',
  paper: 'Paper',
  contrast: 'High contrast',
  paragon: 'Paragon',
  renegade: 'Renegade',
} as const satisfies Readonly<Record<ThemeChoice, string>>;
