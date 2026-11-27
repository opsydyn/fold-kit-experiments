import { Array as Arr, Match, Option, Struct } from 'effect';

import { nextPaint } from '../palette';
import type { Message } from './message';
import { type Cube, cubeNumbered, type Model } from './model';

type AppReturn = { readonly model: Model };

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
    onSome: () => Struct.evolve(model, { right: dropLast }),
    onNone: () => Struct.evolve(model, { left: dropLast }),
  });

/** Moves the last cube of the left shelf to the front. */
const rotate = (cubes: ReadonlyArray<Cube>): ReadonlyArray<Cube> =>
  Option.match(Arr.last(cubes), {
    onNone: () => cubes,
    onSome: (last) => [last, ...cubes.slice(0, -1)],
  });

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      ClickedAdd: () => ({
        model: Struct.evolve(model, {
          left: (left) => [...left, cubeNumbered(model.nextId)],
          nextId: (id) => id + 1,
        }),
      }),
      ClickedMoveAcross: () => ({ model: moveAcross(model) }),
      ClickedRotate: () => ({ model: Struct.evolve(model, { left: rotate }) }),
      ClickedRemove: () => ({ model: removeOne(model) }),
      ClickedCube: ({ key }) => ({
        model: Struct.evolve(model, { left: recolour(key), right: recolour(key) }),
      }),
      HoveredCube: ({ key }) => ({
        model: Struct.evolve(model, { hovered: () => Option.some(key) }),
      }),
      LeftCube: ({ key }) => ({
        model: Struct.evolve(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => current !== key),
        }),
      }),
      ReceivedReconciled: ({ detail }) => ({
        model: Struct.evolve(model, { last: () => Option.some(detail) }),
      }),
      ReceivedSceneLifecycle: () => ({ model }),
    }),
  );
