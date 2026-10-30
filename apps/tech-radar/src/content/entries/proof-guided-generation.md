---
name: Proof-guided generation
category: techniques
ring: assess
summary: Pair candidate proof steps with machine-checked verification rather than plausible prose.
source: https://lean-lang.org/
tags: [ai, verification]
history:
  - edition: '2026-06-14'
    ring: assess
related:
  - to: lean
    type: builds-on
    note: Candidate code or proofs are checked by a prover such as Lean.
  - to: unreviewed-generated-changes
    type: guards-against
    note: A machine-checked proof is evidence a reviewer can rely on.
---

Instead of asking a model for a convincing argument, ask it for candidate proof steps or code, and have a prover such as Lean check each one. The model searches, the checker decides, and only verified results are kept.

It joined in Assess in the third edition. It works today in narrow domains with good formal libraries; wider use depends on specifications being written down. It is one of the strongest answers to _Unreviewed generated changes_.
