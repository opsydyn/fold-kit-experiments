import { Schema } from 'effect';
export const Flags = Schema.Struct({ count: Schema.Literals([100, 1000]), nested: Schema.Boolean });
export type Flags = typeof Flags.Type;
