import { Dom, Subscription } from 'foldkit';

import { LoadThemePreference } from './command';
import { Message } from './message';
import { init as initModel, type Model } from './model';

export { Model } from './model';
export { Message } from './message';
export { update } from './update';
export { view } from './view';

export const init = () => ({ ...initModel(), commands: [LoadThemePreference()] });

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  systemColorScheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-color-scheme: dark)',
      mapMatches: (dark) =>
        Message.ChangedSystemColorScheme({ colorScheme: dark ? 'dark' : 'light' }),
    }),
  ),
}));
