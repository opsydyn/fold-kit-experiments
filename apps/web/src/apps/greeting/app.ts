import { defineApp } from '@opsydyn/astro-foldkit/define-app';

import type { Name } from './model';

export default defineApp<{ name: Name }>(() => import('./main'));
