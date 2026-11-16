import { readable } from './describe.js';
import type { Legend, PlotGeometry } from './types.js';

/**
 * Legends laid out as positioned marks, for outputs with no HTML beside the
 * chart: a standalone SVG and a painted image. Each legend starts a row with
 * its title; entries flow left to right and wrap within the width. A
 * continuous legend is a run of thin bands blending its stops, so neither SVG
 * nor canvas needs a gradient. A page shows legends as HTML instead.
 */

export type LegendMark =
  | Readonly<{ kind: 'swatch'; x: number; y: number; size: number; color: string }>
  /** A symbol's path, centred on (x, y); with no colour, the text colour. */
  | Readonly<{ kind: 'symbol'; x: number; y: number; path: string; color?: string }>
  | Readonly<{ kind: 'band'; x: number; y: number; width: number; height: number; color: string }>
  /** Text from (x, y), y at its middle. */
  | Readonly<{ kind: 'label'; x: number; y: number; text: string; title: boolean }>;

export type LegendLayout = Readonly<{ height: number; marks: ReadonlyArray<LegendMark> }>;

export type LegendFrame = Readonly<{ left: number; top: number; width: number; labelSize: number }>;

const SWATCH = 10;
const SYMBOL = 12;
const BAR = 120;
const BANDS = 48;

/** Text width without a DOM: a generous average glyph width, so labels never overlap. */
const textWidth = (text: string, size: number): number => text.length * size * 0.62;

const RGB = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
const HEX = /^#([0-9a-f]{6})$/i;

/** The channels of an `rgb(...)` or `#rrggbb` colour, or nothing for any other. */
function channels(colour: string): readonly [number, number, number] | undefined {
  const rgb = RGB.exec(colour);
  if (rgb !== null) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = HEX.exec(colour)?.[1];
  if (hex === undefined) return undefined;
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

/** The colour `t` of the way along evenly spaced stops, blended in RGB where both ends parse. */
function blend(stops: ReadonlyArray<string>, t: number): string {
  const at = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(at));
  const [from = '', to = ''] = [stops[i], stops[i + 1]];
  const [a, b] = [channels(from), channels(to)];
  if (a === undefined || b === undefined) return at - i < 0.5 ? from : to;
  const mix = (k: 0 | 1 | 2) => Math.round(a[k] + (b[k] - a[k]) * (at - i));
  return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
}

export function layoutLegends(legends: ReadonlyArray<Legend>, frame: LegendFrame): LegendLayout {
  if (legends.length === 0) return { height: 0, marks: [] };
  const { left, top, width, labelSize } = frame;
  const row = labelSize + 10;
  const right = left + width;
  const marks: LegendMark[] = [];
  let y = top;
  let x = left;
  /** Room for an item `w` wide on this row, or a new row. */
  const place = (w: number): number => {
    if (x > left && x + w > right) {
      x = left;
      y += row;
    }
    const at = x;
    x += w + 14;
    return at;
  };
  const middle = () => y + row / 2;
  const label = (text: string, title = false) => {
    const at = place(textWidth(text, labelSize));
    marks.push({ kind: 'label', x: at, y: middle(), text, title });
  };

  legends.forEach((legend, index) => {
    if (index > 0) {
      x = left;
      y += row;
    }
    if (legend.label !== '') label(legend.label, true);
    switch (legend.kind) {
      case 'categorical':
        for (const entry of legend.entries) {
          const at = place(SWATCH + 6 + textWidth(entry.label, labelSize));
          marks.push({
            kind: 'swatch',
            x: at,
            y: middle() - SWATCH / 2,
            size: SWATCH,
            color: entry.color,
          });
          marks.push({
            kind: 'label',
            x: at + SWATCH + 6,
            y: middle(),
            text: entry.label,
            title: false,
          });
        }
        break;
      case 'symbol':
        for (const entry of legend.entries) {
          const at = place(SYMBOL + 6 + textWidth(entry.label, labelSize));
          const centre = {
            kind: 'symbol',
            x: at + SYMBOL / 2,
            y: middle(),
            path: entry.path,
          } as const;
          marks.push(entry.color === undefined ? centre : { ...centre, color: entry.color });
          marks.push({
            kind: 'label',
            x: at + SYMBOL + 6,
            y: middle(),
            text: entry.label,
            title: false,
          });
        }
        break;
      case 'continuous': {
        const [lo, hi] = legend.domain.map(readable);
        label(lo ?? '');
        const at = place(BAR);
        const band = BAR / BANDS;
        for (let i = 0; i < BANDS; i += 1)
          marks.push({
            kind: 'band',
            x: at + i * band,
            y: middle() - SWATCH / 2,
            width: band,
            height: SWATCH,
            color:
              legend.stops.length === 1
                ? (legend.stops[0] ?? '')
                : blend(legend.stops, i / (BANDS - 1)),
          });
        label(hi ?? '');
        break;
      }
    }
  });
  return { height: y + row - top + 6, marks };
}

/** A standalone chart's legends: in rows below the plot, inside its side margins. */
export const standaloneLegends = (geometry: PlotGeometry, labelSize: number): LegendLayout =>
  layoutLegends(geometry.legends, {
    left: 8,
    top: geometry.height + 4,
    width: geometry.width - 16,
    labelSize,
  });
