/**
 * Series colours. The brand pastels fail the categorical checks (lightness and chroma),
 * so the series use a validated categorical palette instead, stepped separately for the
 * light (#fffefa) and dark (#191c24) promo surfaces. Validated with the dataviz palette
 * checks: CVD ΔE ≥ 9.2, normal-vision ΔE ≥ 26.5 in both modes. Light-mode aqua is under
 * 3:1 against the surface, so the legend and data table carry identity as well.
 */
import type { Series, Theme } from './model';

type Palette = Readonly<Record<Series, number>> & {
  readonly grid: number;
  readonly floor: number;
};

export const palettes = {
  light: { search: 0x2a78d6, social: 0xeb6834, direct: 0x1baf7a, grid: 0xc9c6bd, floor: 0xefece4 },
  dark: { search: 0x3987e5, social: 0xd95926, direct: 0x199e70, grid: 0x434958, floor: 0x262a35 },
} satisfies Record<Theme, Palette>;

/** `colour` mixed `amount` of the way towards white: the hovered or pinned bar. */
export const lighten = (colour: number, amount: number): number => {
  const channel = (shift: number): number => {
    const value = (colour >> shift) & 0xff;
    return Math.round(value + (255 - value) * amount) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};

/** CSS for a series swatch in the given theme. */
export const seriesCss = (theme: Theme, series: Series): string =>
  `#${palettes[theme][series].toString(16).padStart(6, '0')}`;
