/**
 * Catches the scenes three.js creates, through the `__THREE_DEVTOOLS__` hook three
 * notifies when a `Scene` is made, into `globalThis.__observedScenes`. Loaded as its own
 * script before the page's, so it is in place before three loads.
 */
const observed: Array<unknown> = [];
Reflect.set(globalThis, '__observedScenes', observed);

const hook = new EventTarget();
hook.addEventListener('observe', (event) => {
  if (event instanceof CustomEvent) observed.push(event.detail);
});
Reflect.set(globalThis, '__THREE_DEVTOOLS__', hook);
