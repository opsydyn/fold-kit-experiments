---
name: Futhark
category: languages-frameworks
ring: assess
summary: A functional array language for parallel computation.
source: https://futhark-lang.org/
tags: [functional, gpu]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
---

Futhark is a purely functional array language that compiles to fast parallel code for GPUs and multicore CPUs. You write maps, reductions and scans, and the compiler does the low-level parallel work.

It returns to Assess in the fourth edition after being left off the third. It is worth exploring for numeric kernels that would otherwise mean writing CUDA or OpenCL by hand, and as a model of what WebGPU compute might look like at a higher level.
