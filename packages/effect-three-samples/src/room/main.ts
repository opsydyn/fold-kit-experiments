import { Message } from './message';
import { Model } from './model';
import { init, update } from './update';
import { view } from './view';

/**
 * DevTools with the Message schema: in development the Foldkit DevTools MCP server can
 * then dispatch Messages, so an agent can arrange the room (`PlacedPlant`). Camera
 * gestures are left out of the history: they come many to a drag.
 */
export const devTools = { Message, excludeFromHistory: ['MadeGesture'] };

export { init, Message, Model, update, view };
