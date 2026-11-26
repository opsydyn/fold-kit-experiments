import { Match, Option, Struct } from 'effect';

import type { Message } from './message';
import { assetIds, initialModel, type Model, type RobotInfo } from './model';

type AppReturn = { readonly model: Model };

export const init = (props: { readonly assetBase?: string } = {}) => ({
  // The scene asks for its assets (see scene.ts): nothing to run here.
  model: initialModel(props.assetBase ?? '/models/'),
});

/** A level of an asset the scene asked for has loaded: its status settled, by id. */
const loadedAsset = (model: Model, id: string, info: RobotInfo): Model =>
  Match.value(id).pipe(
    Match.withReturnType<Model>(),
    Match.when(assetIds.robot, () => ({ ...model, robot: { _tag: 'Success', data: info } })),
    Match.when(assetIds.floor, () => ({ ...model, floor: { _tag: 'Success', data: info.final } })),
    Match.when(assetIds.font, () => ({ ...model, font: { _tag: 'Success', data: id } })),
    Match.orElse(() => model),
  );

const failedAsset = (model: Model, id: string, reason: string): Model =>
  Match.value(id).pipe(
    Match.withReturnType<Model>(),
    Match.when(assetIds.robot, () => ({ ...model, robot: { _tag: 'Failure', error: reason } })),
    Match.when(assetIds.floor, () => ({ ...model, floor: { _tag: 'Failure', error: reason } })),
    Match.when(assetIds.font, () => ({ ...model, font: { _tag: 'Failure', error: reason } })),
    Match.orElse(() => model),
  );

/** Unloading is no longer asking: the environment cancels or frees what the scene had. */
const unload = (model: Model): Model => ({
  ...model,
  wanted: false,
  robot: { _tag: 'Idle' },
  floor: { _tag: 'Idle' },
  font: { _tag: 'Idle' },
  part: Option.none(),
});

const reload = (model: Model): Model => ({
  ...model,
  wanted: true,
  robot: { _tag: 'Loading' },
  floor: { _tag: 'Loading' },
  font: { _tag: 'Loading' },
});

/** What the scene hears only counts while it asks: an answer to an old request is let be. */
const whileWanted = (model: Model, next: () => Model): Model => (model.wanted ? next() : model);

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      LoadedAsset: ({ id, final, parts, clips }) => ({
        model: whileWanted(model, () => loadedAsset(model, id, { parts, clips, final })),
      }),
      FailedAsset: ({ id, reason }) => ({
        model: whileWanted(model, () => failedAsset(model, id, reason)),
      }),
      ClickedClip: ({ clip }) => ({ model: Struct.assign(model, { clip }) }),
      ChangedSpeed: ({ speed }) => ({ model: Struct.assign(model, { speed }) }),
      ClickedPart: ({ part }) => ({ model: Struct.assign(model, { part: Option.some(part) }) }),
      ClickedUnload: () => ({ model: unload(model) }),
      ClickedReload: () => ({ model: reload(model) }),
      ReceivedSceneLifecycle: ({ lifecycle }) => ({
        model: Struct.assign(model, { sceneStatus: lifecycle }),
      }),
    }),
  );
