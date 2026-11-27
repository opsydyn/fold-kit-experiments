/** Asking the browser about virtual reality, and entering and leaving it. */
import { Command } from '@effect/ui';
import { Effect, Layer } from 'effect';

import { ToyboxEnvironment, toyboxEnvironment } from './environment';
import { Message } from './message';

export class CheckVr extends Command.Service<CheckVr>()('CheckVr', {
  args: {},
  success: Message,
}) {}
export class EnterVr extends Command.Service<EnterVr>()('EnterVr', {
  args: {},
  success: Message,
}) {}
export class ExitVr extends Command.Service<ExitVr>()('ExitVr', { args: {}, success: Message }) {}

export function toyboxLayer() {
  const commands = Layer.mergeAll(
    CheckVr.toLayer(
      Effect.map(
        ToyboxEnvironment,
        ({ xr }) =>
          () =>
            xr
              .supported('immersive-vr')
              .pipe(Effect.map((supported) => Message.CheckedVr({ supported }))),
      ),
    ),
    EnterVr.toLayer(
      Effect.map(
        ToyboxEnvironment,
        ({ xr }) =>
          () =>
            xr.enter('immersive-vr').pipe(
              Effect.match({
                onSuccess: () => Message.ChangedVrSession({ presenting: true }),
                onFailure: () => Message.FailedVr(),
              }),
            ),
      ),
    ),
    ExitVr.toLayer(
      Effect.map(
        ToyboxEnvironment,
        ({ xr }) =>
          () =>
            xr.exit.pipe(Effect.map(() => Message.ChangedVrSession({ presenting: false }))),
      ),
    ),
  );
  return commands.pipe(Layer.provideMerge(toyboxEnvironment));
}
