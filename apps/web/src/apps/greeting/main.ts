import type { Runtime } from 'foldkit';

import { Message } from './message';
import { Flags, init, Model } from './model';
import { update } from './update';
import { view } from './view';

export { Flags, init, Message, Model, update, view };

export type Init = Runtime.ApplicationInit<typeof Model.Type, typeof Message.Type>;
