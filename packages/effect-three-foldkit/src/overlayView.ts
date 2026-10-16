/**
 * Overlay HTML in the scene view: the application's content for each overlay, in an
 * element the scene moves to the overlay's point every frame it draws.
 *
 * @module
 */
import type { Overlay, SceneDescription } from '@opsydyn/effect-three';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { overlayData } from './dom/overlays.ts';

/** HTML shown at a point in the scene, as Drei's `Html`: where, and what. */
export type OverlayView = {
  readonly overlay: Overlay;
  readonly content: Html;
  /**
   * `'auto'` (the default, as Drei): the HTML takes pointer events. `'none'`: they pass
   * through to the canvas, so the scene under a label stays pickable.
   */
  readonly pointerEvents?: 'auto' | 'none';
};

/** The scene with the overlays' points added, so the scene places them. */
export const withOverlays = (
  scene: SceneDescription,
  overlays: ReadonlyArray<OverlayView>,
): SceneDescription =>
  overlays.length === 0
    ? scene
    : { ...scene, overlays: [...scene.overlays, ...overlays.map((view) => view.overlay)] };

// The layer covers the canvas, lets events through, and keeps Drei's large z-indexes
// inside the scene element rather than competing with the page.
const layerStyle = {
  position: 'absolute',
  inset: '0',
  overflow: 'hidden',
  pointerEvents: 'none',
  isolation: 'isolate',
};

/** The overlay layer, or nothing when there are no overlays. */
export const overlayLayer = <Message>(
  h: HtmlBuilder<Message>,
  overlays: ReadonlyArray<OverlayView>,
): ReadonlyArray<Html> =>
  overlays.length === 0
    ? []
    : [
        h.div(
          [h.Style(layerStyle)],
          overlays.map(({ overlay, content, pointerEvents = 'auto' }) =>
            h.keyed('div')(
              overlay.key,
              [
                h.DataAttribute(overlayData.key, overlay.key),
                // Hidden until the scene first places it.
                h.Style({
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  transformOrigin: '0 0',
                  visibility: 'hidden',
                  pointerEvents,
                }),
              ],
              [content],
            ),
          ),
        ),
      ];
