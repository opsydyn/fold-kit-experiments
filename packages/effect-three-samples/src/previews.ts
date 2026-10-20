/**
 * The scenes examples start from, by example id, for stills drawn without a browser
 * (`previewSvg`): the promo draws them when it is built.
 */
import { initialModel as roomModel } from './room/model';
import { sceneFor as roomScene } from './room/scene';
import { init as studioInit } from './studio/model';
import { sceneFor as studioScene } from './studio/scene';

export const previewScenes = {
  room: () => roomScene(roomModel('/models/')),
  studio: () => studioScene(studioInit().model),
};

export type PreviewId = keyof typeof previewScenes;
