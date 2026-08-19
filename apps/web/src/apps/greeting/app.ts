import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Flags } from './model';

export default lazyApp<Flags>(() => import('./main'));
