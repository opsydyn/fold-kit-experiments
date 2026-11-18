import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './main';
// The integration owns this intentional lazy hydration boundary.
// oxlint-disable-next-line linteffect/prevent-dynamic-imports
export default lazyApp<Props>(() => import('./main'));
