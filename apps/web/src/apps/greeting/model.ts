import { Schema } from 'effect';

export const Name = Schema.String.pipe(Schema.brand('Name'));
export type Name = typeof Name.Type;

export const Model = Name;
export type Model = typeof Model.Type;

const Props = Schema.Struct({ name: Name });

export const init = (props: unknown): readonly [Model, readonly []] => [
  Schema.decodeUnknownSync(Props)(props).name,
  [],
];
