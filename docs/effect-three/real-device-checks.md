# Real-device XR checks

Everything XR in effect-three is checked in headless Chromium with Meta's IWER emulating
a Quest 3 (`packages/effect-three-foldkit/e2e/xr.test.ts`). These checks need a headset,
so they are the roadmap's one open item (E) and stay documented limits until someone
runs them. Record each run below: the device, its browser and version, the date, and
what passed.

## Setting up

WebXR needs a secure context. A headset on the same network as `bun dev:three-promo`
(port 4323, started with `--host`) reaches it over plain HTTP, so serve it over HTTPS (a
tunnel, or a local certificate) or forward the port to the headset's `localhost` (on a
Quest, `adb reverse tcp:4323 tcp:4323`). For co-presence, also run `bun run relay` and
open pages with `?relay=ws://<host>:4325/<room>` (`wss://` from an HTTPS page).

## Checks

1. **VR in the room** (`/examples/room/`). Enter VR; the left stick glides and the right
   snap-turns, and letting go keeps the place (`XrMoved`); the left trigger draws the
   teleport arc to the floor and letting go stands you there (`XrTeleported`); the right
   controller plants where it points; the tips label rides the left hand. Put the
   controllers down: tracked hands draw joint by joint and a pinch plants.
2. **AR in the room.** Enter AR; the furniture goes; a select on a real surface plants
   there (hit testing), each plant stays where it was put as you walk (anchors), and the
   detected planes and meshes are drawn where the room is.
3. **The toybox** (`/examples/toybox/`) in VR and AR, as its page describes.
4. **WebGPU.** The room with `?renderer=webgpu`: IWER's emulated layer cannot be drawn by
   `WebGPURenderer`, so WebXR on WebGPU has never presented a frame.
5. **DOM overlay.** No sample sets `xr({ domOverlay: true })`; the e2e checks only the
   session request. Turn it on in the room for a run, enter AR, and check the page's
   buttons show over the camera view and answer taps.
6. **Co-presence** (ADR-020). Two headsets, or a headset and a page, in one relay room:
   each sees the other's head where they stand, facing where they look, and their hands
   (controllers, then tracked hands, whose grips come from the device rather than the
   emulator); judge the lag and how rotations step at 20 reports a second; leaving the
   session or closing the page removes the avatar within two seconds.

## Runs

None yet.
