import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import type { Overlay, SceneDescription } from '@opsydyn/effect-three';
import { overlayData } from '@opsydyn/effect-three-foldkit/browser';

export type SceneOverlay<Message> = {
  readonly overlay: Overlay;
  readonly content: View.Input<Message, never>;
  readonly pointerEvents?: 'auto' | 'none';
};

export const withSceneOverlays = <Message>(
  scene: SceneDescription,
  overlays: ReadonlyArray<SceneOverlay<Message>>,
): SceneDescription =>
  overlays.length === 0
    ? scene
    : { ...scene, overlays: [...scene.overlays, ...overlays.map(({ overlay }) => overlay)] };

export const sceneOverlayLayer = <Message>(
  h: Html.H<Message>,
  overlays: ReadonlyArray<SceneOverlay<Message>>,
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
