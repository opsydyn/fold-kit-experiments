import { Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import { buildingOf, type Model } from './model';

type AppReturn = Return<Model, Message>;

/** Raises a building, or lowers it again. */
const toggleRaised = (raised: ReadonlyArray<number>, index: number): ReadonlyArray<number> =>
  Option.match(
    Option.liftPredicate(index, (candidate) => raised.includes(candidate)),
    {
      onNone: () => [...raised, index],
      onSome: () => raised.filter((other) => other !== index),
    },
  );

const withBuilding = (
  instance: string,
  model: Model,
  apply: (index: number) => Model,
): AppReturn => {
  const next = Option.match(buildingOf(instance), { onNone: () => model, onSome: apply });
  return { model: next };
};

/** Resolution never drops below half: below that the city turns to mush. */
const qualityFloor = 0.5;

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    HoveredBuilding: ({ instance }) =>
      withBuilding(instance, model, (index) =>
        modifyFields(model, { hovered: () => Option.some(index) }),
      ),
    LeftCity: () => ({ model: modifyFields(model, { hovered: () => Option.none() }) }),
    ClickedBuilding: ({ instance }) =>
      withBuilding(instance, model, (index) =>
        modifyFields(model, { raised: (raised) => toggleRaised(raised, index) }),
      ),
    ClickedNewCity: () => ({
      model: { ...model, seed: model.seed + 1, raised: [], hovered: Option.none() },
    }),
    ChangedPerformance: ({ fps, factor }) => ({
      model: { ...model, quality: Math.max(qualityFloor, factor), fps: Option.some(fps) },
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
