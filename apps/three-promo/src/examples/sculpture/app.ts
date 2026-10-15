import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import '@opsydyn/effect-three-samples/styles.css';

export default lazyApp<{ readonly noMeta?: boolean }>(
  () => import('@opsydyn/effect-three-samples/sculpture'),
);
