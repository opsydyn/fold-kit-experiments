import { Mount } from '@effect/ui';
import { Stream } from 'effect';

import { svgSceneInput } from '../../ui/shared/svg-scene-input';
import { RADAR_BASE_RADIUS, RADAR_SIZE } from './geometry';
import { Message } from './message';

export const radarInput = (element: Element) =>
  svgSceneInput<Message>(element, {
    baseRadius: RADAR_BASE_RADIUS,
    viewBoxWidth: RADAR_SIZE,
    started: Message.StartedRadarPointer,
    moved: Message.MovedRadarPointer,
    ended: Message.EndedRadarPointer,
    pressed: Message.PressedRadarKey,
    markerAttribute: 'data-blip-id',
    clicked: (id) => Message.ClickedBlip({ id, keyboard: false }),
  });

export const RadarPointerMount = Mount.makeStream('RadarPointerMount', { args: {} }, (node) =>
  node instanceof Element ? radarInput(node) : Stream.empty,
);
