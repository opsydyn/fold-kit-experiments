import { orbit } from '@opsydyn/effect-three';
import type { Return } from 'foldkit/update';

import { Message } from './message';
import { homeCamera } from './model';
import type { Model } from './model';

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match<Return<Model, Message>>(message, {
    ClickedChart: ({ chart }) => ({ model: { ...model, chart } }),
    ClickedResetView: () => ({ model: { ...model, camera: homeCamera() } }),
    MadeGesture: ({ gesture }) => ({ model: { ...model, camera: orbit(model.camera, gesture) } }),
    ChangedTheme: ({ theme }) => ({ model: { ...model, theme } }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
