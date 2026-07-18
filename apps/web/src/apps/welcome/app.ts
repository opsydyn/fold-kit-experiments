import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Username } from '../profile/model';

export default lazyApp<{ fallback: Username }>(() => import('./main'));
