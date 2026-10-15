import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import '@opsydyn/effect-three-samples/styles.css';

export default lazyApp(() => import('@opsydyn/effect-three-samples/shared'));
