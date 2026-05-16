import { Schema } from 'effect';

import { usernameAtom } from '../../stores/username';
import { Username as UsernameSchema } from '../profile/model';

export const Model = Schema.Struct({ username: Schema.String });
export type Model = typeof Model.Type;

const Props = Schema.Struct({ fallback: UsernameSchema });

export const init = (props: unknown): readonly [Model, readonly []] => {
  const { fallback } = Schema.decodeUnknownSync(Props)(props);
  const stored = usernameAtom.get();
  return [{ username: stored !== '' ? stored : fallback }, []];
};
