/** Loading and unloading the workshop's assets through the shared environment. */
import { Effect, Result, Schema } from 'effect';
import { Command } from 'foldkit';

import { environment } from '../environment';
import { Message } from './message';
import { assetIds } from './model';

const failure = (error: { readonly url: string }) => Result.fail(`Could not load ${error.url}.`);

export const LoadRobot = Command.define('LoadRobot', {
  args: { url: Schema.String },
  messages: [Message.SettledRobot],
  execute: ({ url }) =>
    environment.assets.loadModel(assetIds.robot, url).pipe(
      Effect.match({
        onSuccess: ({ parts, clips }) => Result.succeed({ parts, clips }),
        onFailure: failure,
      }),
      Effect.map((result) => Message.SettledRobot({ result })),
    ),
});

export const LoadFloor = Command.define('LoadFloor', {
  args: { url: Schema.String },
  messages: [Message.SettledFloor],
  execute: ({ url }) =>
    environment.assets.loadTexture(assetIds.floor, url).pipe(
      Effect.match({ onSuccess: (id) => Result.succeed(id), onFailure: failure }),
      Effect.map((result) => Message.SettledFloor({ result })),
    ),
});

export const UnloadAssets = Command.define('UnloadAssets', {
  messages: [Message.CompletedUnload],
  // Suspended: the environment is only touched when the command runs.
  execute: Effect.suspend(() =>
    Effect.all([
      environment.assets.unload(assetIds.robot),
      environment.assets.unload(assetIds.floor),
    ]),
  ).pipe(Effect.map(() => Message.CompletedUnload())),
});
