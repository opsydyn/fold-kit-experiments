import { Schema } from 'effect';

export const Flags = Schema.Struct({ title: Schema.String });
export type Flags = typeof Flags.Type;
