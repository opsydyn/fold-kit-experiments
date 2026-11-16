import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// The web app's DuckDB island, as it runs there. DuckDB-Wasm runs in a Web Worker,
// so the island renders on the client only.
export default lazyApp<{ readonly noMeta?: boolean }>(
  () => import('../../../../web/src/apps/duckdb/main'),
);
