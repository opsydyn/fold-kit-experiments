import { Array as Arr, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { nextPaint } from '../palette';
import { Message } from './message';
import { type Cube, cubeNumbered, type Model } from './model';

type AppReturn = Return<Model, Message>;

const repainted = (cube: Cube): Cube => ({ ...cube, paint: nextPaint(cube.paint) });

const recolour = (key: string) => (cubes: ReadonlyArray<Cube>) =>
  cubes.map((cube) =>
    Option.liftPredicate(cube, (candidate: Cube) => candidate.key === key).pipe(
      Option.match({ onNone: () => cube, onSome: repainted }),
    ),
  );

/** Takes the first cube of `from` and appends it to `to`. */
const shift = (from: ReadonlyArray<Cube>, to: ReadonlyArray<Cube>) =>
  Option.map(Arr.head(from), (cube) => ({ from: from.slice(1), to: [...to, cube] }));

const moveBack = (model: Model): Model =>
  Option.match(shift(model.right, model.left), {
    onNone: () => model,
    onSome: ({ from, to }) => ({ ...model, right: from, left: to }),
  });

/** Moves a cube from the left shelf to the right; once the left is empty, back again. */
const moveAcross = (model: Model): Model =>
  Option.match(shift(model.left, model.right), {
    onSome: ({ from, to }) => ({ ...model, left: from, right: to }),
    onNone: () => moveBack(model),
  });

const dropLast = (cubes: ReadonlyArray<Cube>): ReadonlyArray<Cube> => cubes.slice(0, -1);

/** Removes the last cube of the right shelf, or of the left once the right is empty. */
const removeOne = (model: Model): Model =>
  Option.match(Arr.last(model.right), {
    onSome: () => modifyFields(model, { right: dropLast }),
    onNone: () => modifyFields(model, { left: dropLast }),
  });

/** Moves the last cube of the left shelf to the front. */
const rotate = (cubes: ReadonlyArray<Cube>): ReadonlyArray<Cube> =>
  Option.match(Arr.last(cubes), {
    onNone: () => cubes,
    onSome: (last) => [last, ...cubes.slice(0, -1)],
  });

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedAdd: () => ({
      model: modifyFields(model, {
        left: (left) => [...left, cubeNumbered(model.nextId)],
        nextId: (id) => id + 1,
      }),
    }),
    ClickedMoveAcross: () => ({ model: moveAcross(model) }),
    ClickedRotate: () => ({ model: modifyFields(model, { left: rotate }) }),
    ClickedRemove: () => ({ model: removeOne(model) }),
    ClickedCube: ({ key }) => ({
      model: modifyFields(model, { left: recolour(key), right: recolour(key) }),
    }),
    HoveredCube: ({ key }) => ({ model: modifyFields(model, { hovered: () => Option.some(key) }) }),
    LeftCube: ({ key }) => ({
      model: modifyFields(model, {
        hovered: (hovered) => Option.filter(hovered, (current) => current !== key),
      }),
    }),
    ReceivedReconciled: ({ detail }) => ({
      model: modifyFields(model, { last: () => Option.some(detail) }),
    }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
