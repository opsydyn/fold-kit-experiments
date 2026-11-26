/** XR commands and the scene use the same scoped browser environment. */
import { Command } from '@effect/ui';
import type { Environment } from '@opsydyn/effect-three-foldkit/browser';
import { Context, Effect, Layer } from 'effect';

import {
  createLabelledEnvironment,
  defineScopedSceneMount,
  scopedSceneEnvironment,
} from '../effect-ui-scene';
import { Message, Mode } from './message';

class RoomEnvironment extends Context.Service<RoomEnvironment, Environment>()('RoomEnvironment') {}

export const sceneMount = defineScopedSceneMount(RoomEnvironment);

export class CheckSupport extends Command.Service<CheckSupport>()('CheckSupport', {
  args: { mode: Mode },
  success: Message,
}) {}

export class Enter extends Command.Service<Enter>()('Enter', {
  args: { mode: Mode },
  success: Message,
}) {}

export class Exit extends Command.Service<Exit>()('Exit', {
  args: {},
  success: Message,
}) {}

const environment = Layer.effect(
  RoomEnvironment,
  scopedSceneEnvironment(() => createLabelledEnvironment()),
);

export function roomEnvironmentLayer() {
  const commands = Layer.mergeAll(
    CheckSupport.toLayer(
      Effect.map(
        RoomEnvironment,
        (room) =>
          ({ mode }: { readonly mode: Mode }) =>
            room.xr
              .supported(mode)
              .pipe(Effect.map((supported) => Message.CheckedSupport({ mode, supported }))),
      ),
    ),
    // Enter is issued by a click. Request the session in that browser gesture.
    Enter.toLayer(
      Effect.map(
        RoomEnvironment,
        (room) =>
          ({ mode }: { readonly mode: Mode }) =>
            room.xr.enter(mode).pipe(
              Effect.match({
                onSuccess: () => Message.ChangedSession({ mode }),
                onFailure: () => Message.FailedEnter(),
              }),
            ),
      ),
    ),
    Exit.toLayer(
      Effect.map(
        RoomEnvironment,
        (room) => () => room.xr.exit.pipe(Effect.map(() => Message.ChangedSession({ mode: null }))),
      ),
    ),
  );
  return commands.pipe(Layer.provideMerge(environment));
}
