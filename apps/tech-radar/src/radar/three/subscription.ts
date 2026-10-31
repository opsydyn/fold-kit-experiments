/**
 * The radar's subscriptions: animation frames while the timeline plays or a relay jump
 * rides an edge, and the reader's reduced-motion preference, so jumps land at once for
 * those who ask.
 */
import { Duration, Option, Stream } from 'effect';
import { Dom, Subscription } from 'foldkit';

import { cometMoves } from './comet';
import { konamiCode } from './invaders';
import { Message } from './message';
import type { Model, PointerInput } from './model';
import { shortcuts } from './shortcuts';
import { stackEggMoves } from './stack';
import { stageSizes } from './stageSize';
import type { ColorScheme, ContrastSetting } from './themes';
import { isPlaying } from './tour';

/** What a `(prefers-color-scheme: light)` match means. */
const schemes: ReadonlyArray<ColorScheme> = ['dark', 'light'];

/** What a `(prefers-contrast: more)` or `(forced-colors: active)` match means. */
const contrasts: ReadonlyArray<ContrastSetting> = ['standard', 'more'];

/** What a `(hover: hover)` match means: no, a finger; yes, a mouse or pen. */
const inputs: ReadonlyArray<PointerInput> = ['touch', 'hover'];

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  playback: Subscription.animationFrameEntry({
    isActive: (model) => model.playing,
    toMessage: (deltaTimeMs) => Message.AdvancedPlayback({ deltaTimeMs }),
  }),
  relay: Subscription.animationFrameEntry({
    isActive: (model) => Option.isSome(model.journey),
    toMessage: (deltaTimeMs) => Message.AdvancedRelay({ deltaTimeMs }),
  }),
  // The Konami code, anywhere but in a text field: the invaders' cue.
  konami: Subscription.persistentEntry(
    Dom.streamFromKeyBindings<Message>({
      bindings: [
        {
          keys: konamiCode,
          preventDefault: false,
          mapEvent: () => Message.EnteredKonamiCode(),
        },
      ],
      sequenceTimeout: Duration.seconds(3),
    }),
  ),
  // The keyboard shortcuts, anywhere but in a text field (see shortcuts.ts). Their own
  // stream: the Konami code's arrows may not share a table with single presses.
  shortcuts: Subscription.persistentEntry(
    Dom.streamFromKeyBindings<Message>({
      bindings: shortcuts.flatMap(({ shortcut, keys }) =>
        keys.map((key) => ({ keys: key, mapEvent: () => Message.PressedShortcut({ shortcut }) })),
      ),
    }),
  ),
  // A dense phone screen draws the radar at fewer pixels: it looks the same, and costs less.
  screenDensity: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(min-resolution: 2.5dppx)',
      mapMatches: (isDense) => Message.ChangedScreenDensity({ isDense }),
    }),
  ),
  // The canvas's shape, which the camera's field of view and the labels follow.
  stageAspect: Subscription.persistentEntry(
    Stream.map(stageSizes, ({ width, height }) => Message.ResizedStage({ width, height })),
  ),
  // Leaving the browser's full screen (Esc, a gesture) leaves the immersive radar too.
  fullscreen: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: globalThis.document,
      type: 'fullscreenchange',
      mapEvent: () =>
        Message.ChangedFullscreen({ isFullscreen: globalThis.document.fullscreenElement !== null }),
    }),
  ),
  invasion: Subscription.animationFrameEntry({
    isActive: (model) => Option.isSome(model.invasion),
    toMessage: (deltaTimeMs) => Message.AdvancedInvasion({ deltaTimeMs }),
  }),
  // A tour plays to the frame clock: each move waits out its pace, then the next is made.
  tour: Subscription.animationFrameEntry({
    isActive: (model) => isPlaying(model.tour),
    toMessage: (deltaTimeMs) => Message.AdvancedTour({ deltaTimeMs }),
  }),
  comet: Subscription.animationFrameEntry({
    isActive: cometMoves,
    toMessage: (deltaTimeMs) => Message.AdvancedComet({ deltaTimeMs }),
  }),
  stackEgg: Subscription.animationFrameEntry({
    isActive: stackEggMoves,
    toMessage: (deltaTimeMs) => Message.AdvancedStackEgg({ deltaTimeMs }),
  }),
  // Whether the reader can hover: a phone or tablet cannot, so a tap reads instead.
  pointerInput: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(hover: hover)',
      mapMatches: (canHover) =>
        Message.ChangedPointerInput({ input: inputs[Number(canHover)] ?? 'touch' }),
    }),
  ),
  // The reader's colour scheme, which the theme's Auto choice follows.
  colorScheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-color-scheme: light)',
      mapMatches: (isLight) =>
        Message.ChangedColorScheme({ scheme: schemes[Number(isLight)] ?? 'dark' }),
    }),
  ),
  // A reader who asks for more contrast, or whose system forces its colours, gets High
  // contrast under Auto.
  contrast: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-contrast: more), (forced-colors: active)',
      mapMatches: (isMore) =>
        Message.ChangedContrast({ contrast: contrasts[Number(isMore)] ?? 'standard' }),
    }),
  ),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion }),
    }),
  ),
}));
