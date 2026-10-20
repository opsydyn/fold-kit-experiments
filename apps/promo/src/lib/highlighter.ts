import { createHighlighter } from '@opsydyn/dataset-explorer/highlighting-engine';

/**
 * One highlighter for the whole server. starry-night compiles every grammar into
 * scanners in the oniguruma WebAssembly heap and never frees them, so a highlighter per
 * code block fills that heap a little more on every render until the dev server fails
 * with "fail to memory allocation".
 */
export const highlighter = createHighlighter();
