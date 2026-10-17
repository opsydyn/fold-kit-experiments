/**
 * The part of troika-three-text 0.52.5 this package uses. Its own declarations (generated
 * from JSDoc, in `dist/types`) are not named by its `package.json` and do not declare
 * `Text` a `Mesh`, which it is.
 */
declare module 'troika-three-text' {
  import type { Mesh } from 'three';

  export class Text extends Mesh {
    text: string;
    font: string | null;
    fontSize: number;
    color: number;
    fillOpacity: number;
    anchorX: number | string;
    anchorY: number | string;
    maxWidth: number;
    lineHeight: number | string;
    letterSpacing: number;
    textAlign: string;
    outlineWidth: number;
    outlineColor: number;
    outlineOpacity: number;
    outlineBlur: number;
    sdfGlyphSize: number;
    /** Lays the text out and builds its glyphs in the background, then calls `callback`. */
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
