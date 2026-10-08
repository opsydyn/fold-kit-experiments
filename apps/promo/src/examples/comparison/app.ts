import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './model';

import '../../../../web/src/apps/comparison/comparison.css';
import './comparison-host.css';

export default lazyApp<Props & { readonly noMeta?: boolean }>(() => import('./main'));
