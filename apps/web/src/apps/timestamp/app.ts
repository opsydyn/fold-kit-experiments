import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Iso8601 } from './model';

export default lazyApp<{ startedAt: Iso8601 }>(() => import('./main'));
