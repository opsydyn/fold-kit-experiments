/**
 * The script an interactive page loads (ADR 0110): it hydrates the page the build
 * rendered, with the same app. The build names this file `client-<hash>.js` and stamps
 * that hash on the page as its Foldkit build id, so the script reads its id from its own
 * file name and hydrates only a page built for it.
 */
import { Runtime } from 'foldkit';

import { Flags, init, Model, update, view } from './app';

const script = document.currentScript;
const source = script instanceof HTMLScriptElement ? script.src : '';
const buildId = /client-([0-9a-f]+)\.js/.exec(source)?.[1] ?? 'unbuilt';

Runtime.hydrate(
  Runtime.makeApplication({
    Model,
    Flags,
    init,
    update,
    view,
    container: document.querySelector<HTMLElement>('[data-foldkit-app]'),
    devTools: false,
  }),
  { buildId },
);
