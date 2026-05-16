import { defineApp } from '@opsydyn/astro-foldkit/define-app';

import type { Username } from './model';

export default defineApp<{ defaultName: Username }>(() => import('./main'));
