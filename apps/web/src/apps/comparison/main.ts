import { Schema } from 'effect';
import type { Return } from 'foldkit/update';

import { initialSettings } from './initial-settings';
import { Message } from './message';
import { init as initState, Linking } from './model';
import type { Model as StateModel } from './model';
import { update } from './update';
import { view } from './view';

export const Model = Schema.Struct({
  panels: Schema.Array(Schema.Unknown),
  nextPanelId: Schema.Number,
  linking: Linking,
});
export type Model = StateModel;

// Astro props are intentionally ignored; only maintained initial settings enter the state.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export const init = (_props: unknown): Return<Model, Message> => initState(initialSettings);

export { Message, update, view };
