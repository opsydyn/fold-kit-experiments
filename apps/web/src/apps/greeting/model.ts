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

const Props = Schema.Struct({ name: Name });

export const init = (props: unknown): readonly [Model, readonly []] => {
  const { name } = Schema.decodeUnknownSync(Props)(props);
  return [{ name, locale: 'en' }, []];
};
