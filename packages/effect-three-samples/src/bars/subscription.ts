/**
 * The page theme as a subscription: the host page owns it (a `data-theme` attribute on
 * the root element, dark when absent or unknown), and this app only follows it. Emits
 * the current theme first, then every change.
 */
import { type Cause, Effect, Option, Queue, Schema, Stream } from 'effect';
import { Subscription } from 'foldkit';

import { Message } from './message';
import { type Model, Theme } from './model';

const themeOf = (root: HTMLElement): Theme =>
  Option.getOrElse(Option.liftPredicate(root.dataset.theme, Schema.is(Theme)), () => 'dark');

const observeTheme = (queue: Queue.Queue<Theme, Cause.Done>) => (): MutationObserver => {
  const root = document.documentElement;
  const observer = new MutationObserver(() => Queue.offerUnsafe(queue, themeOf(root)));
  Queue.offerUnsafe(queue, themeOf(root));
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return observer;
};

const disconnect = (observer: MutationObserver) => () => observer.disconnect();

const watchTheme = (queue: Queue.Queue<Theme, Cause.Done>) => {
  const observe = Effect.sync(observeTheme(queue));
  return Effect.acquireRelease(observe, (observer) => Effect.sync(disconnect(observer)));
};

// The observer lives in the stream's scope: it disconnects when the subscription ends.
const themes = Stream.callback<Theme>(watchTheme);

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  theme: Subscription.persistentEntry(
    themes.pipe(
      Stream.changes,
      Stream.map((theme) => Message.ChangedTheme({ theme })),
    ),
  ),
}));
