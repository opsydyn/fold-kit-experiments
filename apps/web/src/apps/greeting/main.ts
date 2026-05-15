import type { Runtime } from 'foldkit';

import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export { Message, Model, init, update, view };

export type Init = Runtime.ProgramInit<typeof Model.Type, typeof Message.Type>;
