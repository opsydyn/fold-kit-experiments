# Effect Three: Requirements Assessment, Plan and Recommendations

Companion to the [brief](brief.md). Prepared 2026-10-14.

**Location:** consolidated into `fold-kit-experiments` on 2026-10-14. The packages are `packages/effect-three` (`@opsydyn/effect-three`, core) and `packages/effect-three-foldkit` (`@opsydyn/effect-three-foldkit`, adapter). Both are `private` until the slice ships. Paths in §6 that read `packages/core` and `packages/foldkit` map to these.

Facts marked **(verified)** were checked against the npm registry, the GitHub API or the published package source on 2026-10-14. Items marked **(spike)** are assumptions to confirm in Phase 0 before anyone writes production code.

---

## 1. Summary

The brief is well scoped. Its non-goals are good (no Drei parity, ECS or physics), and the six vertical-slice proofs are the right acceptance tests. Checking it against the current ecosystem turned up five problems that will block or derail the work if nobody decides them up front:

1. **Requirement 12 names an API that no longer exists.** Foldkit requires Effect 4. Effect 4 dropped the `effect/FastCheck` re-export and now ships its own property-testing engine, `effect/Arbitrary`, which is marked `@stability unstable` (verified). You need to choose between that engine and using `fast-check` directly.
2. **"All oxlint-effect rules, no exceptions" conflicts with a reconciler hot path.** `allRules` for Effect 4 is 141 rules. They include `no-if-statement`, `no-ternary`, `no-switch-statement`, `no-return-in-callback`, `require-span-on-public-service-method` and `no-manual-effect-channels` (verified). Followed literally, these push per-frame and diff code toward `Match`/`Option` allocation and a tracing span on every frame. We need an architectural answer, not a pile of lint disables (see D2).
3. **Foldkit pins `effect` and `@effect/platform-browser` at exactly `4.0.0`** (verified, `foldkit@0.168.0`), while `effect@latest` is `4.0.4`. Two Effect copies in one bundle break service tags and `instanceof` checks. Pin the workspace to match.
4. **Foldkit Mount args are not refreshed after mount.** Its docs say "Args are captured at mount, not refreshed across renders" (verified). The obvious adapter design (pass the scene as Mount args) therefore cannot meet the proof "model changes update existing scene objects". The adapter seam is the most important ADR decision (see D1).
5. **The slice as written can't prove two of its own claims.** A scene with one cube has no second owner of a shared resource, and nothing in the model drives a scene property. The slice needs a second mesh that shares geometry and material, a model-driven property such as colour, and a mount/unmount toggle.

**Recommendation on the ADR:** go greenfield, and treat three-effect as a reference only. It is pinned to `effect@4.0.0-beta.94` and `foldkit@0.102.1` (66 minor versions behind), its reconciler is untyped (`kind: string`, `props: unknown`), disposal goes through hand-rolled `dispose: () => void` handles rather than Effect `Scope`, it ships 60+ primitive modules (exactly the Drei-parity sprawl the brief rules out), and the repo was last pushed on 2026-07-14 (all verified). Section 7 has the full comparison.

---

## 2. Verified ecosystem baseline (2026-10-14)

| Dependency               | Version                      | Notes                                                                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Bun                      | **1.4.3** (2026-10-10)       | Requirement 11 is satisfiable. Pin with `packageManager` and `.bun-version`.                       |
| effect                   | 4.0.4 latest, **pin 4.0.0**  | Foldkit's peer is the exact version `4.0.0`.                                                       |
| @effect/platform-browser | **pin 4.0.0**                | Same exact peer pin.                                                                               |
| foldkit                  | 0.168.0                      | Pre-1.0; "breaking changes may occur in minor releases". Ships a new minor version every few days. |
| three / @types/three     | 0.186.1 / 0.186.0            | @types/three has `ts7.0` / `ts7.1` tags.                                                           |
| typescript               | **7.0.2** (native port)      | Required by oxlint type-aware linting (see below).                                                 |
| oxlint / oxfmt           | 1.88.0 / 0.73.0              | oxfmt is still pre-1.0.                                                                            |
| @opsydyn/oxlint-effect   | 2.0.1 (published 2026-10-09) | 2.x defaults to Effect 4. Its README says it requires Node 22+.                                    |
| oxlint-tsgolint          | ≥ 7.0.2003 (oxlint peer)     | Type-aware engine. Needed for "no unnecessary type assertions".                                    |
| fast-check               | 4.10.2                       | Only needed if we choose it over `effect/Arbitrary` (D3).                                          |
| playwright               | 1.64.1                       | For the browser and visual test suite.                                                             |
| @effect/vitest           | 4.0.4                        | Requires vitest, so it doesn't fit a bun-only test stack. We'll need a small `bun:test` harness.   |

npm names `effect-three`, `@effect-three/core` and `effect-three-foldkit` are all unclaimed (verified with 404 responses).

---

## 3. Requirement-by-requirement assessment

Legend: ✅ clear and testable · ⚠️ needs a decision or acceptance criteria · ❌ conflicts with another requirement or the ecosystem

| #   | Requirement                                                      | Status | Assessment and what's missing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Effect-first, scoped acquisition, cancellation, disposal         | ⚠️     | Right default, but the brief doesn't say where Effect stops. Running an Effect per frame means fiber and allocation overhead at 60–120 Hz. Proposed rule: **Effect owns lifetimes, not frames.** Acquire the renderer, loop, listeners and resources in a `Scope`. Run the per-frame kernel as a plain synchronous callback registered inside `acquireRelease`. Add as acceptance criterion: zero steady-state allocations per frame from library code.                                                                  |
| 2   | Declarative scene + minimal keyed reconciliation                 | ⚠️     | Missing: key uniqueness rules (per sibling list, as in R3F), what happens when a node's kind changes under the same key (replace), whether reparenting is allowed (recommend replace in v0), and a definition of "minimal". Proposal: the diff is a **pure function producing a list of operations**, applied by a separate imperative applier. Minimality can then be asserted by counting operations.                                                                                                                  |
| 3   | Core independent of Foldkit, React, DOM                          | ✅/⚠️  | Achievable: three's scene graph runs without a DOM. Enforce it mechanically. The core `tsconfig` gets `lib: ["ES2023"]` with no `DOM`, and an import-boundary check fails CI if core imports `foldkit`, `react` or DOM globals. Pointer input reaches core as normalised device coordinates, never as a `PointerEvent`.                                                                                                                                                                                                  |
| 4   | Thin Foldkit adapter, typed messages, pure updates               | ❌→⚠️  | Mount args are frozen at mount (see §1). The adapter seam needs a spike (D1). Event payloads must be Schema-decodable (`CustomElement` decodes `CustomEvent.detail` with a Schema), so **scene descriptions must be pure data with no closures**, and pointer handlers map `{ nodeKey, kind }` to Messages in the view. That keeps scene descriptions time-travel and DevTools friendly.                                                                                                                                 |
| 5   | Independent animation loop with a testable clock                 | ⚠️     | `TestClock` alone doesn't drive `requestAnimationFrame`. You need **two** abstractions: a `FrameSource` (rAF, `renderer.setAnimationLoop` for WebGPU and XR, or manual for tests) and time from Effect `Clock`. Also missing: who owns an animated property (D4), frame-loop modes (`always`, `demand`, `never`), pausing when hidden or off-screen, and `prefers-reduced-motion`.                                                                                                                                       |
| 6   | Correct ownership of shared GPU resources                        | ⚠️     | Missing: an ownership taxonomy and a sharing scope. Recommend three modes: **Owned** (node-scoped), **Shared** (reference-counted through Effect `RcMap`, verified present in v4 with `idleTimeToLive`), and **Borrowed** (user-supplied, never disposed). Also define: sharing scope per app Layer vs per canvas, nested leases (a material that holds a texture), and behaviour on WebGL context loss.                                                                                                                 |
| 7   | Renderer boundary that can support WebGPU later                  | ⚠️     | Concrete implications: renderer creation must be **async** (`WebGPURenderer.init()`), the loop must be able to delegate to `setAnimationLoop`, and material descriptions must not expose raw GLSL `ShaderMaterial`, which WebGPURenderer doesn't support. Watch for duplicate three instances when mixing `three` and `three/webgpu` entry points. Add a `Null`/`Recording` renderer for headless tests.                                                                                                                 |
| 8   | Headless scene tests + browser visual tests                      | ⚠️     | Headless is straightforward. Visual tests are underspecified. Needed: a deterministic GPU (SwiftShader/ANGLE in headless Chromium), fixed DPR, size and time, a tolerance policy, goldens generated on Linux CI only, and a **GPU leak oracle** (`renderer.info.memory.geometries/textures` returns to baseline after unmount). Bun has no browser mode, so this suite runs Playwright as a library (spike).                                                                                                             |
| 9   | Strict TS, no `any`, no runtime enums, no unnecessary assertions | ✅/⚠️  | Make it mechanical: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` (bans enums, namespaces and parameter properties), `verbatimModuleSyntax`, plus lint `typescript/no-explicit-any` and the **type-aware** `typescript/no-unnecessary-type-assertion`, which requires `oxlint-tsgolint` and TS 7. A three-specific trap: `mesh.material` is `Material \| Material[]`. A typed per-kind catalogue that stores concrete `Mesh<BoxGeometry, MeshStandardMaterial>` avoids casts. |
| 10  | oxlint-effect all rules, no exceptions; oxlint + oxfmt           | ❌→⚠️  | See D2. Also: (a) `boundaryPaths` defaults to `**/main.ts`, `*.test.ts` and similar. Is configuring boundaries an "exception"? (b) `no-manual-effect-channels` and `no-effect-type-alias` forbid annotating `Effect.Effect<…>`, which conflicts with documented, explicitly typed public APIs and with `isolatedDeclarations`. (c) The plugin says it needs Node 22+, so a bun-only CI image may not be enough (spike). (d) Pin 2.0.1 exactly. It's 5 days old.                                                          |
| 11  | Bun 1.4.x for build and test                                     | ⚠️     | `bun build` doesn't emit `.d.ts` files. Library declarations need `tsgo --emitDeclarationOnly`. `@effect/vitest` is vitest-only, so we write a ~50-line `bun:test` Effect harness. Bun's HTML entrypoints work for the demo dev server and build.                                                                                                                                                                                                                                                                        |
| 12  | Effect's built-in fast-check property tests                      | ❌→⚠️  | See D3. Effect 4 provides `effect/Arbitrary` (`schema()`, `checkEffect`, seeds, shrinking, replay tokens) with no fast-check dependency. It is marked unstable, replay tokens aren't stable across releases, and it has no `fc.commands`-style model-based testing. A plain array of steps is enough for reconciler sequences.                                                                                                                                                                                           |

**On the vertical slice proofs:** all six are right. They need slice additions and test oracles:

| Proof                                                        | Needs                                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model changes update existing objects                        | A model-driven property (cube colour toggled by click). Oracle: same `Object3D.uuid` before and after, and an operation log containing only `UpdateProps`. |
| Pointer → typed Foldkit message                              | Raycast in core over NDC, Schema-typed event detail, Foldkit test asserting the Message.                                                                   |
| Animation without per-frame model updates                    | Oracle: advance 600 frames with `update` instrumented → 0 calls. Rotation equals a pure function of elapsed time.                                          |
| Mount/unmount releases resources and handlers                | A visibility toggle in the demo. Oracle: finaliser log, listener count, and `renderer.info.memory` back to baseline.                                       |
| Shared resources survive until the final owner releases them | **A second mesh (or second canvas) sharing geometry and material.** Oracle: `dispose` event fires only after the last lease closes.                        |
| Deterministic frames and updates                             | Manual `FrameSource` + `TestClock`, plus property tests over random update sequences.                                                                      |

---

## 4. Decisions needed before Phase 1

Each decision has a recommendation. These belong in the ADR or short follow-up ADRs.

### D1. Foldkit adapter seam _(spike both A and B in Phase 0)_

| Option                                 | How                                                                                                                                                                                                                     | Pros                                                                                                                                                                      | Cons                                                                                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. `CustomElement.define`**          | `<effect-three-scene>` with a typed `scene` property and Schema-typed events (`scene-pointer`). The element class owns a `ManagedRuntime` from connect to disconnect.                                                   | Property changes are diffed each render, which is a built-in update hook. Events are Schema-decoded into typed Messages. Same shape as Foldkit's own `Canvas.view`.       | Its lifetime sits outside Foldkit's runtime, so we need a second Effect runtime. Custom elements can't be re-registered, which breaks HMR without a guard. SSR needs a guard.                                |
| **B. `Mount.defineStream` + `h.Prop`** | Plain `<canvas>`. A Mount owns the scope and emits pointer Messages as a Stream. `Prop({ key, value: scene })` pushes new descriptions, which the Mount observes through a property setter feeding a `SubscriptionRef`. | Lifetime is owned and interrupted by Foldkit's runtime and visible in DevTools (`MountTracker`). Gives us `viewStateChanges` for time-travel pause. Uses only public API. | Relies on the order of Prop vs Mount insert (spike). Mount finalisers run asynchronously after `destroy`. Mount `messages` must be declared up front, so the API has to be generic over the user's Messages. |
| C. Command + `ManagedResource`         | `update` returns an `ApplyScene` Command.                                                                                                                                                                               | Matches Foldkit's documented advice for post-mount imperative work.                                                                                                       | The scene is no longer a function of the view. Easy to forget a Command, and it's not declarative.                                                                                                           |

**Recommendation:** prototype A and B against the same three tests: update in place, unmount releases resources, and time-travel pause suppresses events. Lean B: one runtime, lifecycle owned by Foldkit, DevTools visibility. Fall back to A if Prop/Mount ordering proves fragile. Reject C.

**Also verify (spike):** whether Foldkit decodes `CustomElement` property values with Schema on every render. If it does, large scenes need an opaque `Schema.declare` property.

### D2. Lint "all rules, no exceptions" vs the hot path

Many oxlint-effect rules are **import-gated**: they apply to "Effect-imported files". Recommend a sanctioned layering, written into the ADR so it isn't a loophole:

- **`kernel/`**: pure, allocation-conscious TypeScript that does **not** import `effect`. It contains the diff, the applier, the per-frame tick, the raycast and math. Normal `if` and `for` are allowed. It is still covered by every rule that isn't import-gated, plus strict TS, `no-explicit-any` and the type-aware rules. It's tested exhaustively with property tests.
- **`runtime/`**: Effect code (services, scopes, Layers, the Foldkit adapter). Every rule applies.

Also decide:

- Treat `boundaryPaths` as configuration, not an exception. Set it to `src/adapter/**/register.ts`, `test/**` and `bench/**`.
- `require-span-on-public-service-method`: spans on lifecycle methods only. No per-frame public Effect methods should exist, so this follows from the layering.
- `no-manual-effect-channels` vs documented public types: publish public API types from `.d.ts` output (inferred) and document through TSDoc. Don't enable `isolatedDeclarations`.
- `no-raw-time-domain-field`: use branded `Seconds` / `Milliseconds` for frame time in `kernel`, and Effect `Duration` at the boundary.

If you reject the layering, the alternative is `Match` and `Option` throughout, with a measured allocation budget. Benchmark it in Phase 0 before you commit.

### D3. Property-testing engine

- **Recommend `effect/Arbitrary`** (it is what "built-in" means in Effect 4). It derives arbitraries from scene Schemas via `Arbitrary.schema(SceneSchema)` and runs Effectful properties via `checkEffect`. Pin `effect` exactly, because the module is unstable. Wrap it in `test/property.ts` so a later switch to `fast-check` is a one-file change.
- Record failing replay tokens and seeds in CI output (`formatCheckFailure`).

### D4. Who owns an animated property

The cube's rotation is animated, but the model also describes the cube. If the loop mutates `rotation` and the next reconcile writes the model value back, the two fight. **Recommendation:** behaviours are declared as data in the description, for example `Spin({ axis: "y", radiansPerSecond: 1 })`. A property is owned either by the model or by a behaviour, never both, and the type system enforces it. The behaviour's output is a **pure function of elapsed time**, not accumulated state, so the result is deterministic and frame-rate independent.

### D5. Sharing scope for GPU resources

The `ResourceRegistry` is an **app-level Layer** (backed by `RcMap`), so two canvases can share a geometry. Three's `dispose()` notifies every renderer. Keys are either structural (a hash of `BoxGeometry{1,1,1}`) or explicit branded `ResourceId`s. In tests, `idleTimeToLive` is 0 so release is deterministic.

### D6. Testing toolchain under "bun for testing"

- Unit, property and headless tests run on `bun test` with our own `itEffect` harness.
- **Visual tests (spike):** Playwright **library** driven from a `bun test` file, compared with `pixelmatch` or `odiff`. If Playwright under Bun 1.4.3 is unreliable, the fallback needs your sign-off: run `@playwright/test` under Node for this suite only.

### D7. Effect and Foldkit version policy

Pin `effect@4.0.0`, `@effect/platform-browser@4.0.0` and `foldkit@0.168.0` exactly in the workspace. Core peers `effect: ^4.0.0` and `three: >=0.186 <0.187`, a narrow range because three breaks monthly. The adapter peers foldkit by exact minor version. A Renovate rule bumps them together, and CI asserts there's a single copy of `effect` (`bun pm ls effect`).

---

## 5. Recommendations the brief may have missed

Grouped by area. ★ = I'd treat it as a must for the slice.

**Runtime and lifecycle**

- ★ Resize: a `ResizeObserver` in the adapter feeds a core `Viewport` (size, DPR capped at 2), and the camera aspect updates on resize.
- ★ WebGL context loss and restore: a typed `ContextLost` event; resources re-upload on restore (three handles this, but the library must not hold stale state).
- ★ Typed error model with `Data.TaggedError` carrying payloads: `RendererUnavailable`, `DuplicateKey`, `UnknownNodeKind`, `ContextLost`. Errors surface to Foldkit as typed Messages, never thrown.
- Bounded event queues (`no-unbounded-queue-or-pubsub` requires this anyway): a sliding strategy for `pointermove`, emitting only enter/leave **transitions** for hover. Hover needs a per-frame raycast, because objects move under a stationary pointer.
- Pointer capture and drag semantics: defer the API, but don't design it out.
- Frame-loop modes `always | demand | never` plus `invalidate()` (R3F's best idea, and a battery saver).
- Pause the loop when the canvas is off-screen (`IntersectionObserver`) or `prefers-reduced-motion` is set.
- WebGL context limit (~16 per page in Chromium): document it now and design the renderer service so a shared renderer with viewports or scissor regions can come later.
- Foldkit time travel: while `viewStateChanges` reports `Paused`, suppress pointer events and render the historical scene.
- SSR safety: no DOM access at import time, and guard `customElements`.
- HMR: guard custom element registration (`customElements.get`), or option B avoids the issue entirely.

**Resources and three.js specifics**

- ★ Ownership modes Owned / Shared / Borrowed (see requirement 6), with nested leases (material → texture).
- ★ GPU leak oracle in browser tests, based on `renderer.info.memory`.
- Avoid importing both `three` and `three/webgpu`, which duplicates the core. Choose one entry point per renderer backend.
- Typed catalogue per node kind (as R3F's `extend` does, but closed and typed). Unknown kinds fail to type-check, not at runtime.

**Quality, packaging and docs**

- ★ Mechanical enforcement of core purity: no DOM lib in core's `tsconfig`, and an import-boundary check in CI.
- Declarations: `tsgo --emitDeclarationOnly`. Check packages with `publint` and `@arethetypeswrong/cli`. ESM only, `"sideEffects": false`, `three` and `effect` as peers.
- API docs: TSDoc on every export plus a generated reference. **Risk:** TypeDoc and API Extractor depend on the TypeScript JS API, which the TS 7 native port may not fully expose yet (spike). Keeping `typescript@6` as a dev-only docs dependency is acceptable.
- API surface snapshot (API Extractor report or a `.d.ts` diff) to catch accidental breaking changes.
- Changesets for versioning. A clear pre-1.0 semver policy.
- Licensing and clean room: three-effect is Apache-2.0; R3F, Drei and three are MIT. "Reference, don't copy" should be explicit: if any code is ported, keep the NOTICE and attribution. Choose our licence now (MIT matches Foldkit and three).
- Accessibility: canvas `role="img"` plus `aria-label` from the description, and fallback content.
- Browser support matrix: WebGL2 only (three dropped WebGL1), current Chrome, Firefox and Safari.
- CI: GitHub Actions with Bun 1.4.3 (plus Node 22 if oxlint jsPlugins need it), Playwright Chromium, goldens generated on Linux only, and property-test seeds printed on failure.
- Benchmarks need budgets, or they don't gate anything (see §8).

---

## 6. Proposed architecture

```
packages/
  core/                         # no foldkit, no react, no DOM lib
    src/kernel/                 # does NOT import effect: pure + imperative hot path
      description.ts            # node types (data only)
      diff.ts                   # (prev, next) => ReadonlyArray<Op>   (pure)
      apply.ts                  # Op[] x HostCatalogue => mutates three graph
      catalogue.ts              # typed per-kind create/update/dispose
      behaviours.ts             # Spin etc.: (params, elapsed) => transform (pure)
      tick.ts                   # per-frame: behaviours -> hover raycast -> render
      raycast.ts                # NDC -> hit node key
    src/runtime/                # Effect: lifetimes, services, layers, errors
      SceneSchema.ts            # Schema for descriptions (drives Arbitrary + adapter typing)
      Renderer.ts               # Context.Service: WebGL | WebGPU(later) | Null | Recording
      FrameSource.ts            # Context.Service: Raf | AnimationLoop | Manual(test)
      ResourceRegistry.ts       # Context.Service over RcMap: Owned/Shared/Borrowed
      SceneRuntime.ts           # make: scoped; update(desc); events: Stream<SceneEvent>
      errors.ts                 # Data.TaggedError with payloads
  foldkit/                      # thin adapter: the only DOM + foldkit importer
    src/SceneView.ts            # view helper: scene(desc, { onPointer }, h) -> Html
    src/mount.ts | element.ts   # chosen per D1
    src/dom.ts                  # pointer listeners -> NDC, ResizeObserver, IntersectionObserver
examples/demo/                  # Foldkit app: two cubes, shared resources, toggle, click colour
test/                           # harness: itEffect, property helpers, fixtures
bench/                          # mitata benches
e2e/                            # Playwright visual + leak oracle
```

**Data flow**

```
Foldkit model ──view──▶ SceneDescription (pure data, Schema-typed)
                          │ (per render, not per frame)
                          ▼
              SceneRuntime.update ─▶ kernel.diff ─▶ Op[] ─▶ kernel.apply ─▶ three graph
                                                                   ▲
FrameSource ─tick(elapsed from Clock)─▶ kernel.tick: behaviours ───┘ ─▶ Renderer.render
DOM pointer ─adapter─▶ NDC ─▶ kernel.raycast ─▶ SceneEvent (bounded) ─▶ typed Foldkit Message
```

**Key types (sketch, shape not final)**

```ts
// kernel/description.ts: data only, no closures, no three objects
type NodeKey = string & { readonly NodeKey: unique symbol };
type MeshNode = {
  readonly _tag: 'Mesh';
  readonly key: NodeKey;
  readonly geometry: GeometryRef; // { _tag: "Box", w, h, d } | { _tag: "Shared", id }
  readonly material: MaterialRef;
  readonly transform: Transform | undefined; // model-owned...
  readonly behaviour: Behaviour | undefined; // ...or behaviour-owned (D4, type-enforced)
  readonly interactive: boolean;
};

// kernel/diff.ts: the "minimal" in requirement 2 is measured here
type Op =
  | {
      readonly _tag: 'Create';
      readonly parent: NodeKey;
      readonly index: number;
      readonly node: SceneNode;
    }
  | {
      readonly _tag: 'UpdateProps';
      readonly key: NodeKey;
      readonly changed: ReadonlyArray<PropPatch>;
    }
  | { readonly _tag: 'Remove'; readonly key: NodeKey }
  | { readonly _tag: 'Replace'; readonly key: NodeKey; readonly node: SceneNode }; // kind changed

// runtime: Effect owns lifetimes
//   SceneRuntime.make(options) : Effect<SceneHandle, RendererUnavailable, Scope | Renderer | FrameSource | ResourceRegistry>
//   handle.update(desc)        : Effect<void, DuplicateKey | UnknownNodeKind>
//   handle.events              : Stream<SceneEvent>
```

---

## 7. ADR-001 outline: greenfield vs extending three-effect

| Criterion           | Extend three-effect                                                                          | Greenfield                         |
| ------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| Effect version      | `4.0.0-beta.94`: needs migration to 4.0.x                                                    | 4.0.0 from day one                 |
| Foldkit version     | `0.102.1`, 66 minors behind 0.168                                                            | current                            |
| TS / three          | TS 6.0.3, three 0.184                                                                        | TS 7, three 0.186                  |
| Reconciler          | 207 LOC, `kind: string`, `props: unknown`, imperative `update()` returning `boolean \| void` | typed catalogue, pure diff → ops   |
| Disposal model      | handles exposing `dispose: () => void` plus a custom `SceneResourceScope`                    | Effect `Scope` + `RcMap`           |
| Foldkit integration | scene-specific custom elements (`oa-spinning-cube`, …), one renderer per element             | generic declarative scene view     |
| Surface area        | 60+ primitive modules (HUD, MMO, controllers, particles…)                                    | slice only (brief: no Drei parity) |
| Lint posture        | namespace `import * as Three` and untyped props; would fail many oxlint-effect rules         | designed for the ruleset           |
| Activity            | 128 commits, 9 stars, last push 2026-07-14                                                   | —                                  |
| License             | Apache-2.0                                                                                   | ours                               |

**Recommendation: greenfield.** Extending it would mean replacing the reconciler, the disposal model, the Foldkit integration and the version baseline, which is essentially a rewrite carrying an unwanted surface. Worth studying: `frameClockPrimitives.ts`, `resourceScopePrimitives.ts`, `proofReplay.ts`, its headless capture scripts and its `tsconfig.consumer.json` consumer typecheck pattern.

The ADR should also record what we take from each reference:

- **R3F:** host-config catalogue, `frameloop` modes plus `invalidate`, raycast event model, `dispose={null}` opt-out. Avoid its implicit recursive disposal of shared resources and `useLoader`'s never-released cache.
- **Drei:** nothing for the slice. Revisit for loaders and controls later.
- **three:** `dispose()` contracts, `renderer.info`, `setAnimationLoop`, WebGPURenderer's async `init`.
- **Foldkit:** `Canvas.view` as the API precedent, Mount scope semantics, `viewStateChanges`, CustomElement Schema events.

---

## 8. Phased implementation plan

Each phase ends with its exit criteria green in CI.

### Phase 0: Foundations and spikes (≈3–4 days)

1. Repo scaffold: bun workspaces, `packageManager: bun@1.4.3`, TS 7 strict config (§3 row 9), oxlint + `@opsydyn/oxlint-effect@2.0.1` `allRules`, type-aware via `oxlint-tsgolint`, oxfmt, `bun pm ls effect` single-copy check, import-boundary check.
2. **Spike D1:** adapter options A and B against three throwaway tests.
3. **Spike D2:** write a 200-node diff in both kernel style and `Match`/`Option` style. Lint both and benchmark both.
4. **Spike D6:** run Playwright under Bun 1.4.3 headless Chromium with SwiftShader. Render one cube and take a deterministic screenshot twice → identical.
5. Spike: confirm oxlint jsPlugins run under Bun, otherwise Node 22 is required in CI. Confirm TS 7 works with TypeDoc and API Extractor.
6. **Write ADR-001** (greenfield vs extend) plus ADR-002 to ADR-004 (adapter seam, lint layering, property engine).

_Exit:_ ADRs merged. `bun run check` (fmt + lint + typecheck) passes on an empty package.

### Phase 1: Headless core kernel (≈4–5 days)

1. `SceneSchema` and kernel description types for Group, Mesh, PerspectiveCamera, DirectionalLight and AmbientLight, plus Box geometry and Standard material refs.
2. `diff` (keyed, per-sibling) → `Op[]`, and `apply` over a typed catalogue.
3. Property tests (generated from `Arbitrary.schema`):
   - **Convergence:** `apply(diff(a, b))` on a graph built from `a` is structurally equal to a fresh build of `b`.
   - **Idempotence:** `diff(b, b)` is empty.
   - **Identity:** nodes whose key and kind are unchanged keep their `uuid`.
   - **Minimality:** a single property change yields exactly one `UpdateProps`.
   - **Duplicate keys** → `DuplicateKey` error, never a partial apply.
   - **Sequences:** random arrays of descriptions keep these invariants at every step.
4. Behaviours: `Spin` as a pure function of elapsed time, with a property test showing frame-rate independence (N small steps ≡ 1 large step).

_Exit:_ above tests green, plus a coverage gate (proposed ≥ 95% lines for `kernel/`).

### Phase 2: Effect runtime (≈4–5 days)

1. Services: `Renderer` (Null and Recording first, then WebGL), `FrameSource` (Manual first, then Raf / AnimationLoop), `ResourceRegistry` (RcMap; Owned, Shared and Borrowed).
2. `SceneRuntime.make`: scoped, wires the loop and diff/apply, and exposes the `events` Stream (bounded).
3. Raycast → `SceneEvent` from NDC input. Hover transitions only.
4. Tests with `itEffect` + `TestClock` + Manual FrameSource:
   - Advance 600 frames → expected rotation, render count = 600, **0** events emitted without input.
   - Scope close → finaliser order recorded, Recording renderer disposed, every Owned resource disposed.
   - Shared resource: two leases, close one → still alive; close both → `dispose` observed once.
   - Borrowed resource is never disposed.
   - Interruption mid-acquire leaks nothing (property test over interruption points).

_Exit:_ all proofs except the Foldkit-specific ones are green headless.

### Phase 3: Foldkit adapter (≈3–4 days)

1. Implement the D1 choice: `SceneView.scene(desc, { onPointerDown: (key) => Message }, h)`.
2. DOM bridge: pointer → NDC, `ResizeObserver`, `IntersectionObserver`, `prefers-reduced-motion`, time-travel pause.
3. Foldkit tests (`foldkit/test` under bun): click → typed Message. Instrument `update` and run 600 frames → 0 calls. Toggle unmount → listeners removed (count via a wrapped `addEventListener` in a happy-dom or Recording test) and scope closed.

_Exit:_ proofs 2, 3 and 4 green at the adapter level.

### Phase 4: Browser and visual tests, demo (≈3 days)

1. Demo app: two cubes sharing geometry and material, a camera and lights, spin behaviour, click to toggle colour, and a mount/unmount button. Built with `bun build ./examples/demo/index.html`.
2. Playwright suite on WebGL + SwiftShader:
   - Golden screenshots at t = 0 and t = 1.0 s on a frozen clock.
   - Click the cube → colour golden changes, and the `uuid` probe shows the same object.
   - Leak oracle: `renderer.info.memory` baseline → mount → unmount ×20 → baseline.
   - Shared-resource oracle: unmount one cube → geometry count unchanged; unmount both → decremented.

_Exit:_ all six slice proofs green in a real browser.

### Phase 5: Benchmarks, API docs, release readiness (≈2–3 days)

1. `mitata` benches with **proposed** budgets (to tune after measurement):
   - no-op reconcile, 1,000 nodes: < 0.2 ms
   - one prop change in 1,000 nodes: < 0.5 ms and exactly 1 op
   - mount + unmount cycle (Null renderer): < 1 ms
   - per-frame kernel overhead (1 animated node): < 0.05 ms, 0 steady-state allocations
   - CI fails on a >20% regression against the stored baseline.
2. Public API: TSDoc on every export, a generated reference, an API snapshot, a README quick start using the demo, and an ownership guide (Owned, Shared, Borrowed).
3. `publint`, `attw`, a changeset and dry-run publish.

_Exit:_ the brief's Delivery list is complete: tests, benchmarks, working demo, documented public API.

**Rough total: 19–24 working days for one engineer**, most of the risk in Phase 0. If spike D1 or D6 fails, add 2–3 days.

---

## 9. Risk register

| Risk                                                                  | Likelihood | Impact | Mitigation                                                                 |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Foldkit breaking change mid-build (pre-1.0, new minor every few days) | High       | Med    | Exact pin, adapter kept thin, Renovate PRs gated by the adapter test suite |
| Duplicate `effect` copies from the peer pin mismatch                  | Med        | High   | Workspace pin to 4.0.0, single-copy CI check                               |
| Lint ruleset makes the hot path slow or unreadable                    | High       | Med    | D2 layering, Phase 0 benchmark spike                                       |
| `effect/Arbitrary` API churn (unstable)                               | Med        | Low    | Wrapper module, exact pin                                                  |
| Playwright or oxlint plugins misbehave under Bun                      | Med        | Med    | Phase 0 spikes, pre-agreed Node fallback for those tools only              |
| TS 7 incompatibility in doc tooling                                   | Med        | Low    | Separate TS 6 docs toolchain                                               |
| Visual test flakiness (GPU nondeterminism)                            | Med        | Med    | SwiftShader, fixed DPR, frozen clock, tolerance, Linux-only goldens        |
| Mount/Prop ordering in adapter option B                               | Med        | Med    | Spike first, option A as fallback                                          |
| three monthly breaking releases                                       | High       | Low    | Narrow peer range, catalogue isolates three API usage                      |

---

## 10. Decisions (accepted 2026-10-14)

**Status:** Phase 0 complete. Spike evidence is in [spike-results.md](spike-results.md), and ADRs 001–004 are in [adr/](adr). Spikes re-ran green against Foldkit 0.167.0 after consolidation (`bun run test:spikes` in each package).

All recommendations in this plan were accepted. Specifically:

| #   | Decision                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Adapter seam: **resolved by spike** to a hybrid of `CustomElement` props/events plus a one-shot `Mount.define` for lifecycle ([ADR-002](docs/adr/002-foldkit-adapter-seam.md)). |
| D2  | `kernel/` (no `effect` import) / `runtime/` layering is sanctioned; `boundaryPaths` configuration is not an exception.                                                          |
| D3  | Property engine is `effect/Arbitrary`, wrapped in `test/property.ts`; `effect` pinned exactly.                                                                                  |
| D4  | Animated properties are owned by declarative behaviours, type-enforced; behaviour output is a pure function of elapsed time.                                                    |
| D5  | `ResourceRegistry` is an app-level Layer over `RcMap`; Owned / Shared / Borrowed modes.                                                                                         |
| D6  | Bun everywhere; Node 22+ allowed only for tools that cannot run under Bun (Playwright Test, oxlint jsPlugins), decided by spike.                                                |
| D7  | Exact pins: `effect@4.0.0`, `@effect/platform-browser@4.0.0`, `foldkit@0.168.0`; single-copy CI check.                                                                          |
| Q4  | Licence MIT. npm names `effect-three` (core) and `effect-three-foldkit` (adapter) as placeholders; scope and repo host still to confirm.                                        |
| Q5  | Slice extended: two cubes sharing geometry + material, click toggles colour, mount/unmount toggle.                                                                              |
| Q6  | Benchmark budgets in Phase 5 accepted as initial targets, tuned after first measurement.                                                                                        |
