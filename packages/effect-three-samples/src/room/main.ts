import { Message } from './message';
import { Model } from './model';
import { managedResources, subscriptions } from './presence';
import { init, update } from './update';
import { view } from './view';

/**
 * DevTools with the Message schema: in development the Foldkit DevTools MCP server can
 * then dispatch Messages, so an agent can arrange the room (`PlacedPlant`). Camera
 * gestures and presence are left out of the history: they come many a second.
 */
export const devTools = {
  Message,
  excludeFromHistory: [
    'MadeGesture',
    'ReportedPoses',
    'HeardPresence',
    'TickedPresence',
    'CompletedSay',
  ],
};

export { init, managedResources, Message, Model, subscriptions, update, view };
