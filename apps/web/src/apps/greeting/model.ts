import { Schema } from 'effect';

export const Name = Schema.String.pipe(Schema.brand('Name'));
export type Name = typeof Name.Type;

export const Locale = Schema.Literals(['en', 'ar']);
export type Locale = typeof Locale.Type;

export const Model = Schema.Struct({
  name: Name,
  locale: Locale,
});
export type Model = typeof Model.Type;

export const Props = Model;
export type Props = typeof Props.Type;
