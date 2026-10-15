# Greenfield: Effect-native Three.js for Foldkit

Build a new, independent TypeScript library providing declarative Three.js integration with Foldkit, using Effect as the resource and concurrency runtime.

## Research

Study these repositories before implementation:

- https://github.com/mrdoob/three.js
- https://github.com/pmndrs/react-three-fiber
- https://github.com/pmndrs/drei
- https://github.com/OpenAgentsInc/three-effect
- https://github.com/foldkit/foldkit

Compare their architecture, ownership models, scheduling and developer experience.

Treat them as references, not implementations to copy.

## Architecture requirements

1. Effect-first, with scoped acquisition, cancellation and disposal.
2. Declarative scene descriptions and minimal keyed reconciliation.
3. Core independent of Foldkit, React and the DOM.
4. Thin Foldkit adapter with typed messages and pure updates.
5. Independent animation loop with a testable clock.
6. Correct ownership of shared GPU resources.
7. Renderer boundary capable of supporting WebGPU later.
8. Headless scene tests and browser-based visual tests.
9. Strict TypeScript without `any`, runtime enums or unnecessary type assertions.
10. https://www.npmjs.com/package/@opsydyn/oxlint-effect all rules no exc eptions oxlint and of fmt
11. use bun 1.4.x latest for build and testing
12. effects built in fastcheck property based testing suite

## First vertical slice

Implement a scene containing a camera, light and rotating cube.

Prove:
- Model changes update existing scene objects rather than recreating them.
- Pointer interaction dispatches a typed Foldkit message.
- Animation runs without causing Foldkit model updates every frame.
- Mount/unmount cycles release owned resources and event handlers.
- Shared resources survive until their final owner releases them.
- Frame advancement and scene updates can be tested deterministically.

## Delivery

First produce an architecture decision record comparing a greenfield implementation with extending three-effect.

Then implement only the vertical slice.

Avoid premature Drei parity, scene-specific helpers, ECS systems or physics engines.

Finish with tests, benchmarks, a working demo and a documented public API.