/**
 * The part of troika-three-text 0.52.5 this package uses. Its own declarations (generated
 * from JSDoc, in `dist/types`) are not named by its `package.json` and do not declare
 * `Text` a `Mesh`, which it is.
 */
declare module 'troika-three-text/dist/troika-three-text.esm.js' {
  import type { Material, Mesh, Texture } from 'three';

  /** What `getTextRenderInfo` takes: a `Text`'s layout settings. */
  export type TextRenderArgs = {
    readonly text: string;
    readonly font: string | null;
    readonly fontSize: number;
    readonly letterSpacing: number;
    readonly lineHeight: number | string;
    readonly maxWidth: number;
    readonly textAlign: string;
    readonly anchorX: number | string;
    readonly anchorY: number | string;
    readonly colorRanges: Record<number, number> | null;
    readonly sdfGlyphSize: number;
    readonly includeCaretPositions?: boolean;
  };

  /** A laid-out text: per-glyph quads and atlas cells, and the shared distance-field atlas. */
  export type TextRenderInfo = {
    /** Four numbers per glyph: its quad's `[minX, minY, maxX, maxY]`. */
    readonly glyphBounds: Float32Array;
    /**
     * Each glyph's cell in the atlas; four glyphs share a texel, one per channel. troika
     * documents a `Float32Array` but reuses its typesetter's glyph ids, an integer array.
     */
    readonly glyphAtlasIndices: Float32Array | Uint16Array | Uint32Array;
    /** Three bytes per glyph when the text has colour ranges. */
    readonly glyphColors: Uint8Array | null;
    /** The atlas, on troika's own WebGL canvas; shared by every text of a glyph size. */
    readonly sdfTexture: Texture;
    readonly sdfGlyphSize: number;
    readonly sdfExponent: number;
    readonly blockBounds: ReadonlyArray<number>;
    readonly visibleBounds: ReadonlyArray<number>;
  };

  /** Lays text out and builds its glyphs' distance fields, then calls `callback`. */
  export function getTextRenderInfo(
    args: TextRenderArgs,
    callback: (info: TextRenderInfo) => void,
  ): void;

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
    /** Colours from each character index on (experimental in troika). */
    colorRanges: Record<number, number> | null;
    curveRadius: number;
    /** The base material troika derives its text material from; its own when unset. */
    material: Material | Array<Material> | undefined;
    /** The laid-out text, after `sync`: its block and tight glyph bounds. */
    readonly textRenderInfo: {
      readonly blockBounds: ReadonlyArray<number>;
      readonly visibleBounds: ReadonlyArray<number>;
    } | null;
    /** Lays the text out and builds its glyphs in the background, then calls `callback`. */
    sync(callback?: () => void): void;
    dispose(): void;
  }
}
