import { Option, type Result } from 'effect';
import { settle } from 'foldkit/asyncData';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { LoadFloor, LoadRobot, UnloadAssets } from './command';
import { Message } from './message';
import { initialModel, type Model, type RobotInfo } from './model';

type AppReturn = Return<Model, Message>;

/** Commands that load both assets from the model's asset base. */
const loads = (model: Model) => [
  LoadRobot({ url: `${model.assetBase}robot.glb` }),
  LoadFloor({ url: `${model.assetBase}tiles.png` }),
];

export const init = (props: { readonly assetBase?: string } = {}) => {
  const model = initialModel(props.assetBase ?? '/models/');
  return { model, commands: loads(model) };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    SettledRobot: ({ result: rawResult }) => {
      // SAFETY: SettledRobot is only built by LoadRobot, from a Result<RobotInfo, string>.
      // oxlint-disable-next-line linteffect/no-model-overlay-cast
      const result = rawResult as Result.Result<RobotInfo, string>;
      return { model: { ...model, robot: settle(model.robot, result) } };
    },
    SettledFloor: ({ result: rawResult }) => {
      // SAFETY: SettledFloor is only built by LoadFloor, from a Result<string, string>.
      // oxlint-disable-next-line linteffect/no-model-overlay-cast
      const result = rawResult as Result.Result<string, string>;
      return { model: { ...model, floor: settle(model.floor, result) } };
    },
    ClickedClip: ({ clip }) => ({ model: modifyFields(model, { clip: () => clip }) }),
    ChangedSpeed: ({ speed }) => ({ model: modifyFields(model, { speed: () => speed }) }),
    ClickedPart: ({ part }) => ({ model: modifyFields(model, { part: () => Option.some(part) }) }),
    ClickedUnload: () => ({ model, commands: [UnloadAssets()] }),
    CompletedUnload: () => ({
      model: { ...model, robot: { _tag: 'Idle' }, floor: { _tag: 'Idle' }, part: Option.none() },
    }),
    ClickedReload: () => {
      const loading: Model = { ...model, robot: { _tag: 'Loading' }, floor: { _tag: 'Loading' } };
      return { model: loading, commands: loads(loading) };
    },
    ReceivedSceneLifecycle: () => ({ model }),
  });
