import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// Pre-rendered and given no client directive on the page: every chart is
// static HTML and the page ships no JavaScript.
export default lazyApp(() => import('./main'), { prerender: true });
