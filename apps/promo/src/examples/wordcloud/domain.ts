import { Schema } from 'effect';
export const Word = Schema.Struct({ id: Schema.String, text: Schema.String, value: Schema.Number });
export type Word = typeof Word.Type;
export const Font = Schema.Literals(['inter', 'monospace']);
export const Spiral = Schema.Literals(['archimedean', 'rectangular']);
export const Settings = Schema.Struct({
  font: Font,
  spiral: Spiral,
  rotate: Schema.Boolean,
  padding: Schema.Number,
  size: Schema.Number,
});
export type Settings = typeof Settings.Type;
export const Metric = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  value: Schema.Number,
  size: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
  xOffset: Schema.Number,
  yOffset: Schema.Number,
});
export type Metric = typeof Metric.Type;
const families = { inter: '"Inter Variable", sans-serif', monospace: 'monospace' };
export const fontFamily = (font: typeof Font.Type): string => families[font];
export const initialSettings: Settings = {
  font: 'inter',
  spiral: 'archimedean',
  rotate: false,
  padding: 3,
  size: 54,
};
