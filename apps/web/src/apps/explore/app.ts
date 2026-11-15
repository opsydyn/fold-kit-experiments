import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// A million points are generated in the browser and drawn on canvas, so this
// island renders on the client only.
export default lazyApp(() => import('./main'));
