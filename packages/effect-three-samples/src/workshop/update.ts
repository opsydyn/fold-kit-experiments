import { Match, Option } from 'effect';
import { fail, succeed } from 'foldkit/asyncData';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import { assetIds, initialModel, type Model, type RobotInfo } from './model';

type AppReturn = Return<Model, Message>;

export const init = (props: { readonly assetBase?: string } = {}) => ({
  // The scene asks for its assets (see scene.ts): nothing to run here.
  model: initialModel(props.assetBase ?? '/models/'),
});

/** A level of an asset the scene asked for has loaded: its status settled, by id. */
const loadedAsset = (model: Model, id: string, info: RobotInfo): Model =>
  Match.value(id).pipe(
    Match.when(assetIds.robot, () => ({ ...model, robot: succeed(info) })),
    Match.when(assetIds.floor, () => ({ ...model, floor: succeed(info.final) })),
    Match.when(assetIds.font, () => ({ ...model, font: succeed(id) })),
    Match.orElse(() => model),
  );

const failedAsset = (model: Model, id: string, reason: string): Model =>
  Match.value(id).pipe(
    Match.when(assetIds.robot, () => ({ ...model, robot: fail(reason) })),
    Match.when(assetIds.floor, () => ({ ...model, floor: fail(reason) })),
    Match.when(assetIds.font, () => ({ ...model, font: fail(reason) })),
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
  Message.match<AppReturn>(message, {
    LoadedAsset: ({ id, final, parts, clips }) => ({
      model: whileWanted(model, () => loadedAsset(model, id, { parts, clips, final })),
    }),
    FailedAsset: ({ id, reason }) => ({
      model: whileWanted(model, () => failedAsset(model, id, reason)),
    }),
    ClickedClip: ({ clip }) => ({ model: modifyFields(model, { clip: () => clip }) }),
    ChangedSpeed: ({ speed }) => ({ model: modifyFields(model, { speed: () => speed }) }),
    ClickedPart: ({ part }) => ({ model: modifyFields(model, { part: () => Option.some(part) }) }),
    ClickedUnload: () => ({ model: unload(model) }),
    ClickedReload: () => ({ model: reload(model) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
