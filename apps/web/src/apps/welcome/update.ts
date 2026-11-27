import type { Message } from './message';
import type { Model } from './model';

export const update = (_model: Model, { username }: Message): Model => ({ username });
