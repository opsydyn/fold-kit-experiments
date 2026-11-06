import { LoadColorScheme } from './command';
import { init as initModel } from './model';

export { Model } from './model';
export { Message } from './message';
export { update } from './update';
export { view } from './view';

export const init = () => ({ ...initModel(), commands: [LoadColorScheme()] });
