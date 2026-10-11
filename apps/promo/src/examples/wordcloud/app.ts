import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './model';
export default lazyApp<Props & { readonly noMeta?: boolean }>(() => import('./main'));
