import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './main';

// oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Astro island boundary.
export default lazyApp<Props>(() => import('./main'));
