import { Message } from './message';
import { initModel, Model } from './model';
import { subscriptions } from './subscription';
import { loadSlidesOnEntry, update } from './update';
import { view } from './view';

export { Message, Model, subscriptions, update, view };

// init fires loadSlidesOnEntry as a Step: transitions slides Idle→Loading
// and emits LoadSlides. Works identically for cold loads and future
// navigation re-entries (Route.isEntering pattern).
export const init = (_props: unknown) => loadSlidesOnEntry(initModel);
