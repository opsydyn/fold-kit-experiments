import { Mount } from '@effect/ui';
import { Stream } from 'effect';

import { svgSceneInput } from '../../ui/shared/svg-scene-input';
import { Message } from './message';

export const globeInput = (element: Element) =>
  svgSceneInput<Message>(element, {
    baseRadius: 260,
    viewBoxWidth: 600,
    started: Message.StartedGlobePointer,
    moved: Message.MovedGlobePointer,
    ended: Message.EndedGlobePointer,
    pressed: Message.PressedGlobeKey,
    markerAttribute: 'data-event-id',
    clicked: (id) => Message.ClickedMarker({ id, keyboard: false }),
  });

export const GlobePointerMount = Mount.makeStream('GlobePointerMount', { args: {} }, (node) =>
  node instanceof Element ? globeInput(node) : Stream.empty,
);
