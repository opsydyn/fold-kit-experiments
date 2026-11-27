import { Schema } from 'effect';
export const Mode = Schema.Literals(['grouped', 'stacked']);
export const Paint = Schema.Literals(['solid', 'dots', 'hatch', 'gradient']);
export const Orientation = Schema.Literals(['vertical', 'horizontal']);
export const Datum = Schema.Struct({
  id: Schema.String,
  month: Schema.String,
  series: Schema.String,
  value: Schema.Number,
});
export const Props = Schema.Struct({ data: Schema.Array(Datum) });
export type Props = typeof Props.Type;
export const Model = Schema.Struct({
  data: Schema.Array(Datum),
  mode: Mode,
  orientation: Orientation,
  width: Schema.Number,
  activeKey: Schema.NullOr(Schema.String),
  paint: Paint,
});
export type Model = typeof Model.Type;
export const init = ({ data }: Props): Model => ({
  data,
  mode: 'grouped',
  orientation: 'vertical',
  width: 700,
  activeKey: null,
  paint: 'solid',
});
