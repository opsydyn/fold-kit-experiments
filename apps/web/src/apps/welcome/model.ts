import { Schema } from 'effect';

import { usernameAtom } from '../../stores/username';
import { Username as UsernameSchema } from '../profile/model';

export const Model = Schema.Struct({ username: Schema.String });
export type Model = typeof Model.Type;

const InitPropsSchema = Schema.Struct({ fallback: UsernameSchema });
export type InitProps = typeof InitPropsSchema.Type;

export const init = (props: InitProps) => {
  const { fallback } = Schema.decodeUnknownSync(InitPropsSchema)(props);
  const stored = usernameAtom.get();
  return { model: { username: stored !== '' ? stored : fallback } };
};
