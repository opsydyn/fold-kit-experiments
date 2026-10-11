import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

export default lazyApp<{ noMeta?: boolean | '' }>(() => import('./main'));
