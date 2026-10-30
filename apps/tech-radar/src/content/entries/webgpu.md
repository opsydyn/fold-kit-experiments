---
name: WebGPU
category: platforms
ring: assess
summary: A web API for GPU rendering and compute workloads.
source: https://github.com/gpuweb/gpuweb
tags: [web, gpu]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: assess
related:
  - to: webassembly
    type: complements
    note: WebAssembly runs portable compute on the CPU while WebGPU drives the GPU.
---

WebGPU is the modern browser API for GPU rendering and compute, replacing WebGL with an interface closer to Vulkan, Metal and Direct3D 12. Compute shaders bring parallel work, including model inference, to the web.

It stays in Assess. Support has reached the major browsers, and three.js has a WebGPU renderer; keep a WebGL fallback and test on the devices your users have.
