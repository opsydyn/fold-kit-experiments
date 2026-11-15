import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// Pre-rendered at build time and shipped without JavaScript.
export default lazyApp<{ start?: number }>(() => import('./main'), { prerender: true });
