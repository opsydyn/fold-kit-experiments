import { Match, Option, Struct } from 'effect';

import { nextPaint } from '../palette';
import type { Message } from './message';
import type { CubeSize, Model, SceneStatus } from './model';

type AppReturn = { readonly model: Model };

const nextSize = { small: 'large', large: 'small' } satisfies Record<CubeSize, CubeSize>;

const statusFor = (lifecycle: Extract<Message, { _tag: 'ReceivedSceneLifecycle' }>['lifecycle']) =>
  Match.value(lifecycle).pipe(
    Match.tag('StartedScene', (): SceneStatus => 'running'),
    Match.tag('FailedScene', (): SceneStatus => 'failed'),
    Match.exhaustive,
  );

export const update = (model: Model, message: Message): AppReturn =>
  Match.value(message).pipe(
    Match.withReturnType<AppReturn>(),
    Match.tagsExhaustive({
      ClickedCube: () => ({
        model: Struct.evolve(model, { paint: nextPaint, clicks: (clicks) => clicks + 1 }),
      }),
      HoveredCube: ({ key }) => ({
        model: Struct.evolve(model, { hovered: () => Option.some(key) }),
      }),
      LeftCube: ({ key }) => ({
        model: Struct.evolve(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => current !== key),
        }),
      }),
      ClickedToggleSize: () => ({
        model: Struct.evolve(model, { size: (size) => nextSize[size] }),
      }),
      ClickedToggleSecondCube: () => ({
        model: Struct.evolve(model, { showSecondCube: (shown) => !shown }),
      }),
      ClickedToggleScene: () => ({
        model: Struct.evolve(model, {
          showScene: (shown) => !shown,
          status: (): SceneStatus => 'starting',
        }),
      }),
      ReceivedSceneLifecycle: ({ lifecycle }) => ({
        model: Struct.evolve(model, { status: () => statusFor(lifecycle) }),
      }),
    }),
  );
