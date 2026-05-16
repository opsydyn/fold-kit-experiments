import { Schema } from 'effect';

import { usernameAtom } from '../../stores/username';

export const Username = Schema.String.pipe(Schema.brand('Username'));
export type Username = typeof Username.Type;

export const Model = Schema.Struct({
  draft: Schema.String,
  isSaved: Schema.Boolean,
});
export type Model = typeof Model.Type;

const Props = Schema.Struct({ defaultName: Username });

export const init = (props: unknown): readonly [Model, readonly []] => {
  const { defaultName } = Schema.decodeUnknownSync(Props)(props);
  const stored = usernameAtom.get();
  return [{ draft: stored !== '' ? stored : defaultName, isSaved: false }, []];
};
