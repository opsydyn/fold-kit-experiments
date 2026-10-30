---
name: Structured model outputs
category: techniques
ring: trial
summary: 'Constrain output shape with a schema; meaningful content still needs verification.'
source: https://developers.openai.com/api/docs/guides/structured-outputs
tags: [ai, types]
history:
  - edition: '2026-02-14'
    ring: assess
  - edition: '2026-06-14'
    ring: trial
---

Structured outputs constrain a model's response to a JSON schema, so the reply always parses into the shape your code expects. That removes a whole class of brittle parsing.

It moved to Trial in the third edition. A valid shape is not a correct answer: decode the reply with a schema such as Effect Schema, then validate what it means before you act on it.
