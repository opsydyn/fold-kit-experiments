import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { Props } from './model';

import './chart.css';

export default lazyApp<Props & { readonly noMeta?: boolean }>(() => import('./main'));
