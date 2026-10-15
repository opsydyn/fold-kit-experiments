# ADR-002: Foldkit adapter seam is CustomElement properties and events plus a one-shot Mount

- Status: Accepted and implemented (2026-10-14, Phase 3). Time-travel pause is wired but not yet verified end to end.
- Evidence: [d1-adapter spike](https://github.com/opsydyn/fold-kit-experiments/tree/02fa947/packages/effect-three-foldkit/spikes/d1-adapter) (removed after Phase 1; kept in commit `02fa947`), [spike results](../spike-results.md#d1-details)

## Context

The adapter must (a) update existing scene objects when the model changes, (b) turn pointer interaction into typed Foldkit Messages, (c) release every owned resource and listener on unmount, and (d) keep Foldkit's `update` pure.

Foldkit constraints, verified in `foldkit@0.168.0`:

- Mount args are captured once at mount and never refreshed.
- `Prop` is not part of the public `foldkit/html` surface.
- `CustomElement.define` exposes typed property factories that are diffed per render, and event factories that Schema-decode `CustomEvent.detail`.
- `Mount.define` keeps its scope open for the element's lifetime. `Mount.defineStream` closes its scope when the stream completes.
- A Mount's `execute` has `R = never`.

## Options considered

- **A. CustomElement whose element class owns its runtime.** Works, but the lifecycle sits outside Foldkit's runtime: a second runtime, invisible to DevTools, with HMR re-registration hazards.
- **B. Mount + a raw `Prop`.** Relies on non-public API.
- **C. A Command plus a `ManagedResource` that pushes scene updates from `update`.** The scene stops being a function of the view, and nothing is declarative.
- **Hybrid (chosen).** `CustomElement.define` supplies the typed `scene` property and typed events. `Mount.define` on the same element acquires the scene runtime in Foldkit's fiber and releases it on unmount.

## Decision

```ts
// Shape of the public adapter (names provisional)
const scene = EffectThreeFoldkit.scene.withMessage(h);
scene(
  [
    scene.Scene(description), // diffed property; pure data
    scene.OnScenePointer((d) => ClickedNode({ nodeKey: d.nodeKey })), // Schema-decoded, typed
    h.OnMount(EffectThreeFoldkit.lifecycle(services)), // scope = element lifetime
  ],
  [],
);
```

- The Mount installs a property interceptor that feeds a bounded "latest scene" slot. The runtime dedupes structurally equal descriptions, because Foldkit re-sets the property with a fresh object on every render.
- Pointer events: the DOM listener → normalised device coordinates (NDC) → core raycast → `element.dispatchEvent(new CustomEvent("scene-pointer", { detail }))` → Foldkit decodes the detail → the user's Message.
- Services (renderer, frame source, resource registry) come from an adapter-built Layer passed to `lifecycle(...)`. The app builds it once at its entry boundary, so shared resources span every scene in the app (D5).
- The custom element tag is registered only when a browser registry exists, guarded by `customElements.get`, so the code is SSR- and HMR-safe.

## Consequences

- Only public Foldkit APIs are used, and the lifecycle is owned and interrupted by Foldkit's runtime.
- Mount finalisers run asynchronously after snabbdom's `destroy`. All teardown must be self-contained (no ordering assumptions about sibling DOM).
- We need a structural equality fast path for descriptions. Reference equality isn't enough.
- Open (Phase 3): suppress events while `viewStateChanges` is `Paused` (DevTools time travel).

## Implementation notes (Phase 3)

The shipped API, in `packages/effect-three-foldkit`:

```ts
// entry: once per app
const environment = EffectThreeFoldkit.makeEnvironment(window);
const sceneMount = EffectThreeFoldkit.makeSceneMount(environment);

// view
EffectThreeFoldkit.view(
  {
    scene: sceneFor(model),
    mount: sceneMount,
    onLifecycle: (lifecycle) => GotSceneLifecycle({ lifecycle }),
    onClick: ({ key }) => ClickedNode({ key }),
  },
  h,
);
```

What changed from the decision above:

- **No `customElements.define`.** The Mount intercepts the `scene` property directly, so there's no element class to register, re-register under HMR, or guard during SSR.
- **One DOM event per pointer kind** (`scene-click`, `scene-pointer-enter`, and so on, plus `scene-error`). Apps bind only the handlers they pass; unbound events dispatch nothing.
- **Lifecycle Messages are the library's own** (`StartedScene`, `FailedScene`) and are lifted into the app's union with `Mount.mapMessage` through `onLifecycle`.
- **Services are provided with `provideService`, not a Layer.** A Layer provided to `SceneRuntime.make` would be released as soon as `make` returned.
- **WebGL contexts are released on unmount** with `forceContextLoss()`. The browser test found that without it, Chromium starts dropping contexts after about 16 mount/unmount cycles.
- **Scene values are Schema-decoded** at the property boundary (`MalformedScene` on failure), because the DOM property is `unknown`. Benchmark this in Phase 5.
