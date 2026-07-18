import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Username } from './model';

export default lazyApp<{ defaultName: Username }>(() => import('./main'));
