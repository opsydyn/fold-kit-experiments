import type { Runtime } from 'foldkit';

import { FetchHealth } from './command';
import { Message } from './message';
import { init as initialModel, Model } from './model';
import { update } from './update';
import { view } from './view';

export { subscriptions } from './subscription';
export { Message, Model, update, view };

export const init: Runtime.ProgramInit<typeof Model.Type, typeof Message.Type> = () => [
  initialModel,
  [FetchHealth()],
];
