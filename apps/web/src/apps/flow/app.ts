import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
export default lazyApp(() => import('./main'));
