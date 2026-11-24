import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './main';
// oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Astro island entry point
export default lazyApp<Props>(() => import('./main'), { prerender: true });
