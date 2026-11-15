import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// Two plot specs, pre-rendered: the maps ship as static HTML with no JavaScript.
export default lazyApp(() => import('./main'), { prerender: true });
