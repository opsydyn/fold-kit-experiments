import { Array as Arr, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { nextPaint } from '../palette';
import { Message } from './message';
import type { Model } from './model';

type AppReturn = Return<Model, Message>;

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedCube: ({ index }) => ({
      model: modifyFields(model, {
        paints: (paints) => Option.getOrElse(Arr.modify(paints, index, nextPaint), () => paints),
      }),
    }),
    HoveredCube: ({ index }) => ({
      model: modifyFields(model, { hovered: () => Option.some(index) }),
    }),
    LeftCube: ({ index }) => ({
      model: modifyFields(model, {
        hovered: (hovered) => Option.filter(hovered, (current) => current !== index),
      }),
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
