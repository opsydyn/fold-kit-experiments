# Changelog

## [0.6.0](https://github.com/opsydyn/fold-kit-experiments/compare/effect-three-v0.5.0...effect-three-v0.6.0) (2026-10-21)


### Features

* **effect-three:** snapshot a world on until, and start a run from one ([881d520](https://github.com/opsydyn/fold-kit-experiments/commit/881d5206531c8f0a42fce1e1428034a41e558656))
* **effect-three:** worlds keep their latest stops, and a run goes back to one ([fef50ab](https://github.com/opsydyn/fold-kit-experiments/commit/fef50abcb7974c8e67242537d8fc38ceb294cb3e))

## [0.5.0](https://github.com/opsydyn/fold-kit-experiments/compare/effect-three-v0.4.0...effect-three-v0.5.0) (2026-10-20)

### Features

- **effect-three:** a scene says which assets it asks for ([219db07](https://github.com/opsydyn/fold-kit-experiments/commit/219db071c91d3f2048610deac68ede3467b5e6d9))
- **effect-three:** coarser levels of detail on an asset ([ee6929e](https://github.com/opsydyn/fold-kit-experiments/commit/ee6929e4822bad60e705cf3ab4893f07a6d320a8))
- **effect-three:** physics on the Model's clock, for worlds that must agree ([e91612c](https://github.com/opsydyn/fold-kit-experiments/commit/e91612c50b20be408df2e6e287203456ae45fe1b))
- **effect-three:** previewSvg draws a scene as SVG without a browser ([c731d12](https://github.com/opsydyn/fold-kit-experiments/commit/c731d1248c5924574fa2dbc3ed343518fa328cba))
- **effect-three:** worlds that step elsewhere report until once answered ([009a60f](https://github.com/opsydyn/fold-kit-experiments/commit/009a60f2f25acd77071c9e288ba5d6fcd8dfa248))

## [0.4.0](https://github.com/opsydyn/fold-kit-experiments/compare/effect-three-v0.3.0...effect-three-v0.4.0) (2026-10-20)

### Features

- **effect-three:** a HUD, and the viewport gizmo in it ([a1d99d4](https://github.com/opsydyn/fold-kit-experiments/commit/a1d99d477d80744652237c0718fe0f2418490ea8))
- **effect-three:** a measuring tape, the last widget of Beyond parity 5 ([0a05ae0](https://github.com/opsydyn/fold-kit-experiments/commit/0a05ae04b0ccfd616f945f26429b27acbe79f108))
- **effect-three:** a scene vocabulary for assistants ([a138ccb](https://github.com/opsydyn/fold-kit-experiments/commit/a138ccb3c38226149b44d7b56ce488be8ebbcd89))
- **effect-three:** a transform gizmo as data, and as a Foldkit submodel ([3b1e585](https://github.com/opsydyn/fold-kit-experiments/commit/3b1e58535b35669917c3325214199f9264fb314c))
- **effect-three:** an inspector generated from schemas ([64d1d3b](https://github.com/opsydyn/fold-kit-experiments/commit/64d1d3b8bf9991c57c1cf56b94a8b3f1c773b17d))
- **effect-three:** box select as data, and as a Foldkit submodel ([498a2ec](https://github.com/opsydyn/fold-kit-experiments/commit/498a2ecd7763208c17b54b85f5cc8af294c7ce9b))
- **effect-three:** edges, trails, points, sparkles and stars ([f976907](https://github.com/opsydyn/fold-kit-experiments/commit/f9769078724c7ef405728581574d50001f338e81))
- **effect-three:** lockstep, and the editor edited together across tabs ([b416557](https://github.com/opsydyn/fold-kit-experiments/commit/b416557da1e5b5c0d2669891c41e365f48ca818c))
- **effect-three:** pivot controls as data, and as a Foldkit submodel ([4284921](https://github.com/opsydyn/fold-kit-experiments/commit/42849211eed2b745c4a43ad42682e2508829901b))
- **effect-three:** scene files, branching history and review diffs ([ce2c54e](https://github.com/opsydyn/fold-kit-experiments/commit/ce2c54ef7cefa77ab07ee7126782b9abccb15adc))

## [0.3.0](https://github.com/opsydyn/fold-kit-experiments/compare/effect-three-v0.2.0...effect-three-v0.3.0) (2026-10-19)

### Features

- **effect-three:** Drei's Billboard, RoundedBox and Backdrop, Detailed, CameraShake and Clone ([3ec570e](https://github.com/opsydyn/fold-kit-experiments/commit/3ec570e14e7632565adf846ef48b66287713a291))

## [0.2.0](https://github.com/opsydyn/fold-kit-experiments/compare/effect-three-v0.1.0...effect-three-v0.2.0) (2026-10-19)

### ⚠ BREAKING CHANGES

- **effect-three:** `RenderKit.drawsLabels` is gone; a render kit names its `shading` instead. Code that spreads a renderer factory to instrument it is unaffected.

### Features

- **effect-three:** render kits name their kind of material; label engines may draw with TSL ([8059fde](https://github.com/opsydyn/fold-kit-experiments/commit/8059fde41349297dea0c7c3383361333dc6a25ad))

## 0.1.0 (2026-10-18)

### Features

- **effect-three-foldkit:** Foldkit adapter with WebGL renderer and browser tests ([5e2816d](https://github.com/opsydyn/fold-kit-experiments/commit/5e2816d4a46138777db0cb656a9c3436328c8be4))
- **effect-three:** a rigid body per instance ([cc39435](https://github.com/opsydyn/fold-kit-experiments/commit/cc39435b878c781c7bf35e00e4b50ddc6d92b035))
- **effect-three:** a WebGPU renderer ([94a0964](https://github.com/opsydyn/fold-kit-experiments/commit/94a0964c723c9c8bea555a0054d52c2224fcc00c))
- **effect-three:** after R5 — WebGPU, render kits, glide, physics groups, XR spaces ([e5bde71](https://github.com/opsydyn/fold-kit-experiments/commit/e5bde71212353879d74aa32567c3eb9cbbeb38ac))
- **effect-three:** animation clips on borrowed objects ([719e73e](https://github.com/opsydyn/fold-kit-experiments/commit/719e73ed8053ba60ff1ecf7902d89735c1d74e31))
- **effect-three:** basic, lambert, phong, standard, physical and normal materials ([5baa690](https://github.com/opsydyn/fold-kit-experiments/commit/5baa690ef51dce7c1ae9ea53cfc0b6c70b9565c3))
- **effect-three:** benchmarks, API reports, package checks and CI browser tests ([5640b2d](https://github.com/opsydyn/fold-kit-experiments/commit/5640b2dc2a078642f15f157fa77b491e1443305d))
- **effect-three:** bodies on groups and loaded models ([b06179c](https://github.com/opsydyn/fold-kit-experiments/commit/b06179c4baa878fb65dc2f15a43a3e275b7bf682))
- **effect-three:** borrowed objects and lent textures ([6e4c010](https://github.com/opsydyn/fold-kit-experiments/commit/6e4c010bc21da24aadea61bee76b3a39963cda4a))
- **effect-three:** camera auto-rotate, and damping for view cameras ([c563b69](https://github.com/opsydyn/fold-kit-experiments/commit/c563b697753d8d2c0eed05ecfc935ad0d48f693a))
- **effect-three:** close the parity gaps and prepare the packages for npm ([994fe5d](https://github.com/opsydyn/fold-kit-experiments/commit/994fe5dd640583c787746a95e8465d8f051d78df))
- **effect-three:** colliders of a body's own, motors, contact forces and debug lines ([2a16c9e](https://github.com/opsydyn/fold-kit-experiments/commit/2a16c9e0f8432872e008bbd747eede1472c6ba44))
- **effect-three:** collision groups and colliders named in collisions ([9531a01](https://github.com/opsydyn/fold-kit-experiments/commit/9531a01f54e9e19b8ccc301152167d0ac52c3229))
- **effect-three:** declarative, diffed instancing ([26f70b3](https://github.com/opsydyn/fold-kit-experiments/commit/26f70b3ea5f20d5d4c33e36d3056bb15d2053334))
- **effect-three:** demo app, package builds and visual tests ([1649d49](https://github.com/opsydyn/fold-kit-experiments/commit/1649d496c3387eb63233665da4ccc6e1def2aa64))
- **effect-three:** Drei's shader grid, centring and environment presets ([a9467c7](https://github.com/opsydyn/fold-kit-experiments/commit/a9467c7580e24c0e93ee6742bb71ebd1da08a5e5))
- **effect-three:** eased transitions and sphere, plane and cylinder geometry ([26187f1](https://github.com/opsydyn/fold-kit-experiments/commit/26187f12e8ffed91993802c0128e2be03ea3ba41))
- **effect-three:** Effect runtime with scoped scenes, frame source and pointer events ([e7dec61](https://github.com/opsydyn/fold-kit-experiments/commit/e7dec61ce9fa57594fe606f9453a3115566a4cf8))
- **effect-three:** environment lighting and a shadow catcher ([023d2de](https://github.com/opsydyn/fold-kit-experiments/commit/023d2dedc8ab7b6a46a6ef23a1dc0f364af80816))
- **effect-three:** event bubbling paths, interactive groups and drag capture ([546a946](https://github.com/opsydyn/fold-kit-experiments/commit/546a94631923532bf5c11ff5b4ad7b19be64195e))
- **effect-three:** every hit carries the pointer's world-space ray ([a7b3a46](https://github.com/opsydyn/fold-kit-experiments/commit/a7b3a46aa09eecaa04d7c73158b5fbf388a12cb6))
- **effect-three:** frame-rate monitoring and render resolution ([64f9027](https://github.com/opsydyn/fold-kit-experiments/commit/64f902794d58bc5ef7bfbb19c0e2cbfa753e6f8b))
- **effect-three:** full pointer event set with R3F semantics ([d9c6366](https://github.com/opsydyn/fold-kit-experiments/commit/d9c6366931c5e6c7414ce3a4a04bd1ef8da6b019))
- **effect-three:** headless core kernel with property-tested keyed reconciliation ([a579695](https://github.com/opsydyn/fold-kit-experiments/commit/a5796951fc9545236a360ad62dc50c523c017b8c))
- **effect-three:** HTML overlays at points in the scene ([d0d016f](https://github.com/opsydyn/fold-kit-experiments/commit/d0d016f1896eb05927f154b0941662b7afc6112e))
- **effect-three:** immersive sessions (WebXR) ([9e003d1](https://github.com/opsydyn/fold-kit-experiments/commit/9e003d125813e2ce72477fd544242bc5b03cac73))
- **effect-three:** joints, and bodies no longer remade by rounding ([66ebf4d](https://github.com/opsydyn/fold-kit-experiments/commit/66ebf4d0a4bcd580699e9a7f371919397e95585c))
- **effect-three:** label colour ranges, curves, materials and layout ([ad9942e](https://github.com/opsydyn/fold-kit-experiments/commit/ad9942e49a540ab346a62fa00481c8c4d40ede11))
- **effect-three:** lent geometries and XR detected meshes ([832388b](https://github.com/opsydyn/fold-kit-experiments/commit/832388bbe6833d248d1d437f01c6e1a31aba08ce))
- **effect-three:** multiple views into one canvas ([b732a7c](https://github.com/opsydyn/fold-kit-experiments/commit/b732a7c4b6ddb50f846f71d4fa4401786a76d2a3))
- **effect-three:** orbit controls as data ([067af99](https://github.com/opsydyn/fold-kit-experiments/commit/067af99a443c1c3000bfb3e424ae43e5995366d0))
- **effect-three:** orthographic camera ([ac05a7e](https://github.com/opsydyn/fold-kit-experiments/commit/ac05a7e60307150e7707533b9ee14457ec5110ab))
- **effect-three:** physics as data, simulated by Rapier ([dd99e1c](https://github.com/opsydyn/fold-kit-experiments/commit/dd99e1cbde789e5b578ec6b28278893e5725b326))
- **effect-three:** post-processing effects ([1e2aa60](https://github.com/opsydyn/fold-kit-experiments/commit/1e2aa60533696b4db9158fd3de5d978bc601a063))
- **effect-three:** registered behaviours as data ([68eef53](https://github.com/opsydyn/fold-kit-experiments/commit/68eef530b7f43cb59ac45822064b0d1518887cc4))
- **effect-three:** render frames on demand ([9df4a06](https://github.com/opsydyn/fold-kit-experiments/commit/9df4a06adc9493a64fd0ef183e562c06568285fd))
- **effect-three:** render textures as data ([cbc5f3d](https://github.com/opsydyn/fold-kit-experiments/commit/cbc5f3d54a844ea623c28b9223a0561586771737))
- **effect-three:** scaffold Effect-native Three.js packages with Phase 0 ADRs ([02fa947](https://github.com/opsydyn/fold-kit-experiments/commit/02fa9476801e8609e311174023016b262e108427))
- **effect-three:** shadows and scene render settings ([4140595](https://github.com/opsydyn/fold-kit-experiments/commit/41405952fbe709ab6453f51b9cfd53b7e1adb40e))
- **effect-three:** sky and grid staging ([03e9f4f](https://github.com/opsydyn/fold-kit-experiments/commit/03e9f4f5c81a6dbe2a0e29720f768380ff86e737))
- **effect-three:** stage lighting as scene parts ([8686f13](https://github.com/opsydyn/fold-kit-experiments/commit/8686f13da31425c49e8d9f73e0baf78b0ce82eb2))
- **effect-three:** text geometry from lent typeface fonts ([c573453](https://github.com/opsydyn/fold-kit-experiments/commit/c573453ae3acef5356a184eb3030495ed08389af))
- **effect-three:** torus, cone, capsule, ring and circle; point, spot and hemisphere lights ([3d695fe](https://github.com/opsydyn/fold-kit-experiments/commit/3d695fe6f9d85ffd70e3762dcdf586ce7cbb94de))
- **effect-three:** update telemetry, shared samples package and apps/web samples ([f7cd64d](https://github.com/opsydyn/fold-kit-experiments/commit/f7cd64da19496e6137d8daa669ada99cae01d546))
- **effect-three:** XR controllers, and VR in the toybox ([861f008](https://github.com/opsydyn/fold-kit-experiments/commit/861f0082819ad3b1898be9e86dd9c537de637cee))
- **effect-three:** XR hover and drag, hands, sticks, AR surfaces ([35597b9](https://github.com/opsydyn/fold-kit-experiments/commit/35597b937b2721b823040b2c67468d6ab9224fd0))
- **effect-three:** XR spaces, anchors, planes and DOM overlay ([0041c7c](https://github.com/opsydyn/fold-kit-experiments/commit/0041c7c9ebbe066f2c2300ae23283dfa68cc7451))
- **effect-three:** zoom to cursor, arrow keys and camera fitting ([e14224b](https://github.com/opsydyn/fold-kit-experiments/commit/e14224b5dc11ac1d371ce1061ad41ca73879fc6f))

### Performance Improvements

- **effect-three:** reconcile 1,000 unchanged meshes in about 95 µs ([1069d8a](https://github.com/opsydyn/fold-kit-experiments/commit/1069d8a1a9cbd344eb6d59fd6dc290d5c436f121))
