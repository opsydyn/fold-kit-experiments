import { createHighlighter } from '@opsydyn/dataset-explorer/highlighting-engine';

/** One build/server engine, matching Viz and Three; never allocate WASM per block. */
export const highlighter = createHighlighter();
