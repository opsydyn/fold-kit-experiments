import type { ClientDirective } from 'astro';

const enablesHover = (value: string | { readonly hover?: boolean } | null): boolean =>
  value instanceof Object && value.hover === true;

const triggers = ['pointerdown', 'focusin', 'keydown', 'pointerover'] as const;

/**
 * Preserve clicks while the renderer waits for Effect UI to adopt the tree.
 * Effect UI itself reads pending form edits from adopted browser controls.
 */
const interaction: ClientDirective = (load, options, island) => {
  const root = island.querySelector(':scope > [data-effect-ui-root]');
  const window = island.ownerDocument.defaultView;
  const hover = enablesHover(options.value);
  if (!root || !window) {
    void load().then((hydrate) => hydrate());
    return;
  }

  const clicks: Array<Readonly<{ target: Element; event: MouseEvent }>> = [];
  let started = false;
  let removed = false;
  const stop = () => {
    for (const type of triggers) island.removeEventListener(type, start, true);
    island.removeEventListener('click', captureClick, true);
    island.removeEventListener('astro:unmount', onUnmount);
  };
  const onUnmount = () => {
    removed = true;
    stop();
  };
  const targetInsideRoot = (event: Event) => {
    const target = event.target;
    return target instanceof window.Element &&
      root.contains(target) &&
      target.closest('astro-island') === island
      ? target
      : null;
  };
  const start = (event: Event) => {
    if (started || !targetInsideRoot(event)) return;
    if (
      event.type === 'pointerover' &&
      (!hover || !('pointerType' in event) || event.pointerType !== 'mouse')
    )
      return;
    started = true;
    void load()
      .then((hydrate) => (removed || !island.isConnected ? undefined : hydrate()))
      .then(() => {
        stop();
        if (removed || !island.isConnected) return;
        for (const { target, event } of clicks) {
          if (
            root.contains(target) &&
            target.closest('astro-island') === island &&
            target.closest(':disabled') === null
          ) {
            target.dispatchEvent(new window.MouseEvent('click', event));
          }
        }
      })
      .catch((error) => {
        stop();
        console.error('Could not activate the Effect UI island.', error);
      });
  };
  const captureClick = (event: MouseEvent) => {
    const target = targetInsideRoot(event);
    if (!target) return;
    start(event);
    // Links and native control edits retain their browser behavior during adoption.
    if (target.closest('a[href], label, input[type="checkbox"], input[type="radio"]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clicks.push({ target, event });
  };

  for (const type of triggers) island.addEventListener(type, start, true);
  island.addEventListener('click', captureClick, true);
  island.addEventListener('astro:unmount', onUnmount, { once: true });
};

export default interaction;
