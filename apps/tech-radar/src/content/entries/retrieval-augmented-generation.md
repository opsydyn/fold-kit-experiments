---
name: Retrieval-augmented generation
category: techniques
ring: trial
summary: Bring retrieved documents into generation instead of relying only on model parameters.
source: https://arxiv.org/abs/2005.11401
tags: [ai]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
related:
  - to: structured-model-outputs
    type: complements
    note: 'Retrieved context grounds an answer; a schema shapes it into checkable data.'
---

Retrieval-augmented generation finds relevant documents and gives them to the model with the question, so answers draw on your sources rather than only on what the model memorised. It keeps answers current and makes citations possible.

It moved to Trial in the second edition. Most of the work is in retrieval: chunking, ranking and evaluation. Measure whether the right passages are found before tuning prompts.
