---
name: Ollama
category: tools
ring: trial
summary: Run and work with language models through a local-first tool interface.
source: https://ollama.com/
tags: [ai, local]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: trial
related:
  - to: llama-cpp
    type: builds-on
    note: "Ollama has run many models through llama.cpp's inference engine."
---

Ollama makes running a language model locally a one-line command, with a model library and an HTTP API that many tools speak. It handles downloads, quantised models and GPU use for you.

It moved to Trial in the third edition. It is useful for private experiments, offline development and comparing models on your own data. Measure answer quality for your task; a local model is not a drop-in replacement for a hosted frontier model.
