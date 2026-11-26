import { defineMessageUnion } from 'foldkit/message';

import { BrowserInput } from './browser-input';

export { BrowserInput, type ZlozPortAnchorSnapBypassModifier } from './browser-input';
export const InputMessage = defineMessageUnion({ ObservedZlozInput: { event: BrowserInput } });
