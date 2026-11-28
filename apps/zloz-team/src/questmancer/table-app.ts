import { astroComponent } from '@opsydyn/astro-effect-ui/component';
import { Predicate } from 'effect';

import { QuestmancerTable } from './main';

if (
  import.meta.env.DEV &&
  !import.meta.env.SSR &&
  import.meta.env.PUBLIC_QUESTMANCER_DEVTOOLS === '1' &&
  ['localhost', '127.0.0.1'].includes(location.hostname)
) {
  const { DevTools } = await import('@effect/ui-devtools');
  // The hook must register before Astro hydrates the table's root.
  if (Predicate.hasProperty(DevTools, 'attach') && Predicate.isFunction(DevTools.attach)) {
    const detach = DevTools.attach({ webMcp: false });
    import.meta.hot?.dispose(detach);
  }
}

export default astroComponent(QuestmancerTable);
