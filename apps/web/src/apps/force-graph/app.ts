import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// A plot spec, pre-rendered: the chart ships as static HTML with no JavaScript.
export default lazyApp(() => import('./main'), { prerender: true });
