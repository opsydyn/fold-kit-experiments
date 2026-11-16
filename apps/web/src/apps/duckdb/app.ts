import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// DuckDB-Wasm runs in a Web Worker in the browser, so this island renders on the client only.
export default lazyApp(() => import('./main'));
