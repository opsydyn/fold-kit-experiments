import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// The web app's /explore island: a million points made in the browser and drawn on
// the GPU, so the island renders on the client only.
export default lazyApp<{ readonly noMeta?: boolean }>(
  () => import('../../../../web/src/apps/explore/main'),
);
