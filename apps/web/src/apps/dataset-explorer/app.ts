import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
import type { Props } from '@opsydyn/dataset-explorer/model';

export default lazyApp<Props>(() => import('@opsydyn/dataset-explorer'));
