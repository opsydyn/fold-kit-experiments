import { Schema } from 'effect';

import { Username } from '../profile/model';

export const Model = Schema.Struct({ username: Schema.String });
export type Model = typeof Model.Type;

export const Props = Schema.Struct({ fallback: Username });
export type InitProps = typeof Props.Type;

export const init = ({ fallback }: InitProps): Model => ({ username: fallback });
