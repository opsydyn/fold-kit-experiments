# effect-three reference checkouts

Behavioural references for parity work. They are shallow clones at the root of the main
checkout, ignored by git (`.gitignore`), and skipped by oxlint and oxfmt for the same
reason. Read them; don't copy from them (see the R3F reference rule in `CLAUDE.md`).

| Checkout                   | Upstream                                                                    | Pinned commit | Commit date | Version     | Licence    | Use for                                                                                               |
| -------------------------- | --------------------------------------------------------------------------- | ------------- | ----------- | ----------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `react-three-fiber-main/`  | [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)     | `d74622e`     | 2026-10-14  | fiber 9.8.1 | MIT        | Events, frame loop, `invalidate`/`advance`, disposal, `primitive`, portals, root configuration        |
| `drei-main/`               | [pmndrs/drei](https://github.com/pmndrs/drei)                               | `bf6f4ad`     | 2026-09-30  | master      | MIT        | Helpers, controls, loaders and staging (final roadmap phase)                                          |
| `react-three-rapier-main/` | [pmndrs/react-three-rapier](https://github.com/pmndrs/react-three-rapier)   | `ae5c3fe`     | 2025-11-03  | 2.2.0       | MIT        | Physics (R5): `Physics` stepping, `RigidBody` options, auto colliders, `InstancedRigidBodies`, joints |
| `react-three-xr-main/`     | [pmndrs/xr](https://github.com/pmndrs/xr)                                   | `0e1acd8`     | 2026-10-15  | main        | MIT        | XR (R5): session init, pointers, hit tests, controller locomotion, IWER emulation                     |
| `three-effect-main/`       | [OpenAgentsInc/three-effect](https://github.com/OpenAgentsInc/three-effect) | `714c37e`     | 2026-07-14  | main        | Apache-2.0 | Secondary: prior Effect + Foldkit bindings (see ADR-001)                                              |
| `node_modules/three`       | [mrdoob/three.js](https://github.com/mrdoob/three.js)                       | —             | —           | 0.186.1     | MIT        | Ground truth for three.js behaviour, including `examples/jsm` controls and loaders                    |

Where to start in R3F (`packages/fiber/src`):

- `core/events.ts`: the handler set, the intersection payload, propagation and pointer capture.
- `core/loop.ts`: `frameloop` modes, `invalidate(frames)` and `advance(timestamp)`.
- `core/configuration.ts`: root options (`gl`, `dpr`, `shadows`, `flat`, `linear`, `orthographic`, `frameloop`, `performance`, `raycaster`, `onPointerMissed`).
- `core/reconciler.tsx`: `primitive`, `attach`, and disposal (`dispose={null}` opt-out, `disposeOnIdle`).
- `core/hooks.tsx`: `useFrame` priorities, `useLoader`; `core/portal.tsx`: `createPortal`.

## Refreshing a pin

From the main checkout root:

```sh
git -C react-three-fiber-main fetch --depth 1 origin master
git -C react-three-fiber-main checkout FETCH_HEAD
git -C react-three-fiber-main rev-parse --short HEAD
```

Then update the table. A new pin changes what "parity" means, so note it in the roadmap
if any row's status changes.
