/** The promo brand palette, as scene colours. */
import { Schema } from 'effect';

export const Paint = Schema.Literals(['blue', 'coral', 'gold', 'mint', 'lavender', 'periwinkle']);
export type Paint = typeof Paint.Type;

export const paints: ReadonlyArray<Paint> = Paint.literals;

export const paintColour = {
  blue: 0x3d79fa,
  coral: 0xfa8b79,
  gold: 0xf5ce60,
  mint: 0x80d7bb,
  lavender: 0xb38bf5,
  periwinkle: 0xb3c9fc,
} satisfies Record<Paint, number>;

/** CSS for a swatch, matching the scene colour. */
export const paintCss = (paint: Paint): string =>
  `#${paintColour[paint].toString(16).padStart(6, '0')}`;

/** The paint after `paint`, cycling through the palette. */
export const nextPaint = (paint: Paint): Paint =>
  paints[(paints.indexOf(paint) + 1) % paints.length] ?? paint;

/** The paint for the `index`th item, cycling through the palette. */
export const paintAt = (index: number): Paint => paints[index % paints.length] ?? 'blue';
