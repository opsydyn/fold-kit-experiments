import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
import type { Props } from '@opsydyn/dataset-explorer/model';

import '@opsydyn/dataset-explorer/styles.css';

export default lazyApp<Props & { readonly noMeta?: boolean }>(
  () => import('@opsydyn/dataset-explorer'),
);
