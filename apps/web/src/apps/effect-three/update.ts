import { Match, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import type { CubeSize, Model, Paint, SceneStatus } from './model';

type AppReturn = Return<Model, Message>;

const nextPaint = { teal: 'amber', amber: 'teal' } satisfies Record<Paint, Paint>;
const nextSize = { small: 'large', large: 'small' } satisfies Record<CubeSize, CubeSize>;

const statusFor = (lifecycle: Extract<Message, { _tag: 'ReceivedSceneLifecycle' }>['lifecycle']) =>
  Match.value(lifecycle).pipe(
    Match.tag('StartedScene', (): SceneStatus => 'running'),
    Match.tag('FailedScene', (): SceneStatus => 'failed'),
    Match.exhaustive,
  );

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    ClickedCube: () => ({
      model: modifyFields(model, {
        paint: (paint) => nextPaint[paint],
        clicks: (clicks) => clicks + 1,
      }),
    }),
    HoveredCube: ({ key }) => ({ model: modifyFields(model, { hovered: () => Option.some(key) }) }),
    LeftCube: ({ key }) => ({
      model: modifyFields(model, {
        hovered: (hovered) => Option.filter(hovered, (current) => current !== key),
      }),
    }),
    ClickedToggleSize: () => ({
      model: modifyFields(model, { size: (size) => nextSize[size] }),
    }),
    ClickedToggleSecondCube: () => ({
      model: modifyFields(model, { showSecondCube: (shown) => !shown }),
    }),
    ClickedToggleScene: () => ({
      model: modifyFields(model, {
        showScene: (shown) => !shown,
        status: (): SceneStatus => 'starting',
      }),
    }),
    ReceivedSceneLifecycle: ({ lifecycle }) => ({
      model: modifyFields(model, { status: () => statusFor(lifecycle) }),
    }),
  });
