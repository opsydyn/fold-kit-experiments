import { defineApp } from '@opsydyn/astro-foldkit/define-app';

import type { Username } from '../profile/model';

export default defineApp<{ fallback: Username }>(() => import('./main'));
