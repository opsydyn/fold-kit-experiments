import { orbit } from '@opsydyn/effect-three';
import { Match, Struct } from 'effect';

import type { Message } from './message';
import { homeCamera, type Model } from './model';

export const update = (model: Model, message: Message): Model =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      ClickedChart: ({ chart }) => Struct.assign(model, { chart }),
      ClickedResetView: () => Struct.assign(model, { camera: homeCamera() }),
      MadeGesture: ({ gesture }) => Struct.assign(model, { camera: orbit(model.camera, gesture) }),
      ChangedTheme: ({ theme }) => Struct.assign(model, { theme }),
      ReceivedSceneLifecycle: ({ lifecycle }) => Struct.assign(model, { lifecycle }),
    }),
  );
