import { Message } from './message';
import { init, Model } from './model';
import { update } from './update';
import { view } from './view';

export { init, Message, Model, update, view };

/**
 * For the Foldkit DevTools MCP server: an agent can read the Model and dispatch
 * Messages, intents such as `PlacedThing`, `FramedShot` and `ChoseMood` among them, each
 * decoded by its schema first. Pointer moves are left out of the history it reads.
 */
export const devTools = {
  Message,
  excludeFromHistory: ['MadeGesture', 'DraggedScene', 'HoveredScene', 'LeftScene'],
};
