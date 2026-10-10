import wasmUrl from 'vscode-oniguruma/release/onig.wasm?url';

import { createHighlighter } from './highlighting-engine';
export const createBrowserHighlighter = () => createHighlighter(wasmUrl);
