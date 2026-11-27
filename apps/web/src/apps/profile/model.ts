import { Schema } from 'effect';

export const Username = Schema.String.pipe(Schema.brand('Username'));
export type Username = typeof Username.Type;

export const Model = Schema.Struct({
  draft: Schema.String,
  edited: Schema.Boolean,
  isSaved: Schema.Boolean,
});
export type Model = typeof Model.Type;

export const Props = Schema.Struct({ defaultName: Username });
export type InitProps = typeof Props.Type;

export const init = ({ defaultName }: InitProps): Model => ({
  draft: defaultName,
  edited: false,
  isSaved: false,
});
