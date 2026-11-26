import { Match, Option, Struct } from 'effect';

import type { Message } from './message';
import { buildingOf, type Model } from './model';

type AppReturn = { readonly model: Model };

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
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      HoveredBuilding: ({ instance }) =>
        withBuilding(instance, model, (index) =>
          Struct.evolve(model, { hovered: () => Option.some(index) }),
        ),
      LeftCity: () => ({ model: Struct.evolve(model, { hovered: () => Option.none() }) }),
      ClickedBuilding: ({ instance }) =>
        withBuilding(instance, model, (index) =>
          Struct.evolve(model, { raised: (raised) => toggleRaised(raised, index) }),
        ),
      ClickedNewCity: () => ({
        model: { ...model, seed: model.seed + 1, raised: [], hovered: Option.none() },
      }),
      ChangedPerformance: ({ fps, factor }) => ({
        model: { ...model, quality: Math.max(qualityFloor, factor), fps: Option.some(fps) },
      }),
      ReceivedSceneLifecycle: () => ({ model }),
    }),
  );
