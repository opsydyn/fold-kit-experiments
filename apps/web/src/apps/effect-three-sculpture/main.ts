import type { Runtime } from 'foldkit';

export { init, Message, Model, update, view } from '@opsydyn/effect-three-samples/sculpture';

/**
 * Time-travel DevTools: click a history row to install that Model's view. The scene is a
 * pure function of the Model, so it rewinds too, and pointer input pauses until you resume.
 */
export const devTools: Runtime.DevToolsConfig = { mode: 'TimeTravel', position: 'BottomRight' };
