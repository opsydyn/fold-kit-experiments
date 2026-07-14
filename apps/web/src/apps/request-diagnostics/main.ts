import { FetchMetrics } from './command';
import { Message } from './message';
import { initModel, Model } from './model';
import { update } from './update';
import { view } from './view';

export { Model, Message, update, view };

export const init = () => [initModel, [FetchMetrics()]] as const;
