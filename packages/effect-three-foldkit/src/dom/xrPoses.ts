/**
 * Reporting where the player's head and hands are while presenting (`xr({ poses })`):
 * every so many seconds of the session's frames, the viewer's pose and each hand's grip
 * in the presented space, which is the scene's (the reference space is offset to the
 * player's origin), so other players can be shown them (ADR-020).
 *
 * Behavioural reference: pmndrs/xr at `0e1acd8`, `space.ts`: a space's pose is read from
 * the frame in the reference space each frame, and there is none while the frame has no
 * pose for it. A hand is its input source's `gripSpace`, which WebXR gives tracked hands
 * (at the palm) as well as controllers.
 *
 * @module
 */
import type { BodyPose, XrInput } from '@opsydyn/effect-three';

/** One session frame: reports poses if `every` seconds have passed since the last report. */
export type PoseReporter = (
  frame: XRFrame,
  space: XRReferenceSpace,
  time: number,
  every: number | null,
) => void;

function poseOf(pose: XRPose | null | undefined): BodyPose | null {
  if (pose === null || pose === undefined) return null;
  const { position: p, orientation: o } = pose.transform;
  return { position: [p.x, p.y, p.z], quaternion: [o.x, o.y, o.z, o.w] };
}

/** The grip of the source held in (or that is) `hand`, if the frame tracks it. */
function gripOf(frame: XRFrame, space: XRReferenceSpace, hand: XRHandedness): BodyPose | null {
  for (const source of frame.session.inputSources) {
    if (source.handedness === hand && source.gripSpace !== undefined) {
      return poseOf(frame.getPose(source.gripSpace, space));
    }
  }
  return null;
}

/** A reporter that passes `Poses` to `input`, starting with the session's first frame. */
export function reportPoses(input: (input: XrInput) => void): PoseReporter {
  let last: number | undefined;
  return (frame, space, time, every) => {
    if (every === null || (last !== undefined && time - last < every * 1000)) return;
    const head = poseOf(frame.getViewerPose(space));
    if (head === null) return;
    last = time;
    input({
      _tag: 'Poses',
      head,
      left: gripOf(frame, space, 'left'),
      right: gripOf(frame, space, 'right'),
    });
  };
}
