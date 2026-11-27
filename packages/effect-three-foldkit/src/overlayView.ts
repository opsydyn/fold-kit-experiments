import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { Overlay, SceneDescription } from '@opsydyn/effect-three';
import { overlayData } from '@opsydyn/effect-three/browser';

/** HTML shown at a point in the scene. */
export type OverlayView<Message> = {
  readonly overlay: Overlay;
  readonly content: View.Input<Message, never>;
  readonly pointerEvents?: 'auto' | 'none';
};

export const withOverlays = <Message>(
  scene: SceneDescription,
  overlays: ReadonlyArray<OverlayView<Message>>,
): SceneDescription =>
  overlays.length === 0
    ? scene
    : { ...scene, overlays: [...scene.overlays, ...overlays.map(({ overlay }) => overlay)] };

export const overlayLayer = <Message>(
  h: Html.H<Message>,
  overlays: ReadonlyArray<OverlayView<Message>>,
) =>
  overlays.length === 0
    ? null
    : h.div
        .style({
          position: 'absolute',
          inset: '0',
          overflow: 'hidden',
          pointerEvents: 'none',
          isolation: 'isolate',
        })
        .children(
          ...overlays.map(({ overlay, content, pointerEvents = 'auto' }) =>
            h.div
              .key(overlay.key)
              .attr(overlayData.attribute, overlay.key)
              .style({
                position: 'absolute',
                top: '0',
                left: '0',
                transformOrigin: '0 0',
                visibility: 'hidden',
                pointerEvents,
              })
              .children(content),
          ),
        );
