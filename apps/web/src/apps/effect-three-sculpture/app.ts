import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import '@opsydyn/effect-three-samples/styles.css';

// Astro renders pages itself, so the Foldkit Vite plugin's index.html hook never injects
// the DevTools overlay. Register it here, in development only, before the island starts.
if (import.meta.env.DEV) await import('virtual:foldkit-devtools-overlay');

export default lazyApp(() => import('./main'));
