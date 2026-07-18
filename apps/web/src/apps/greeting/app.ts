import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Name } from './model';

export default lazyApp<{ name: Name }>(() => import('./main'));
