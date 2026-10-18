import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import '@opsydyn/effect-three-samples/styles.css';

export default lazyApp<{ readonly assetBase?: string }>(
  () => import('@opsydyn/effect-three-samples/marbles'),
);
