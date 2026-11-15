import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// Rendered on the server, then hydrated in the browser.
export default lazyApp<{ start?: number }>(() => import('./main'));
