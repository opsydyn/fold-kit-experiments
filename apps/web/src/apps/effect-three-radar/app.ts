import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
import type { RadarProps } from '@opsydyn/effect-three-samples/radar';

import '@opsydyn/effect-three-samples/styles.css';

export default lazyApp<RadarProps>(() => import('@opsydyn/effect-three-samples/radar'));
