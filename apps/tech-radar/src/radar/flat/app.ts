import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { FlatRadarProps } from './model';

export default lazyApp<FlatRadarProps>(() => import('./main'));
