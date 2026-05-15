import { Schema } from 'effect';

import type { Message } from './message';
import type { Model } from './model';
import { Name } from './model';

const defaultName = Schema.decodeSync(Name)('World');

export const update = (_model: Model, _message: Message): readonly [Model, readonly []] => [
  defaultName,
  [],
];
