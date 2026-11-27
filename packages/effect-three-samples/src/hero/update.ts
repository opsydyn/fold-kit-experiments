import { Array as Arr, Match, Option, Struct } from 'effect';

import { nextPaint } from '../palette';
import type { Message } from './message';
import type { Model } from './model';

type AppReturn = { readonly model: Model };

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      ClickedCube: ({ index }) => ({
        model: Struct.evolve(model, {
          paints: (paints) => Option.getOrElse(Arr.modify(paints, index, nextPaint), () => paints),
        }),
      }),
      HoveredCube: ({ index }) => ({
        model: Struct.evolve(model, { hovered: () => Option.some(index) }),
      }),
      LeftCube: ({ index }) => ({
        model: Struct.evolve(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => current !== index),
        }),
      }),
      ReceivedSceneLifecycle: () => ({ model }),
    }),
  );
