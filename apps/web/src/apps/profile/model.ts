import { Schema } from 'effect';

import { usernameAtom } from '../../stores/username';

export const Username = Schema.String.pipe(Schema.brand('Username'));
export type Username = typeof Username.Type;

export const Model = Schema.Struct({
  draft: Schema.String,
  isSaved: Schema.Boolean,
});
export type Model = typeof Model.Type;

const InitPropsSchema = Schema.Struct({ defaultName: Username });
export type InitProps = typeof InitPropsSchema.Type;

export const init = (props: InitProps) => {
  const { defaultName } = Schema.decodeUnknownSync(InitPropsSchema)(props);
  const stored = usernameAtom.get();
  return { model: { draft: stored !== '' ? stored : defaultName, isSaved: false } };
};
