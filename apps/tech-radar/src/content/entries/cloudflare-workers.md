---
name: Cloudflare Workers
category: platforms
ring: trial
summary: An application platform for deploying code onto Cloudflare infrastructure.
source: https://developers.cloudflare.com/workers/
tags: [web]
history:
  - edition: '2025-10-14'
    ring: assess
  - edition: '2026-02-14'
    ring: trial
  - edition: '2026-06-14'
    ring: trial
---

Workers run code close to users with a fast start and no servers to look after, with storage such as KV, D1, R2 and Durable Objects next to it. This radar itself is served from a Worker, deployed with Alchemy.

It moved to Trial in the second edition. It suits request-shaped work and sites with a small server part. Check the runtime's limits early, such as CPU time, memory and Node API coverage, before committing a heavy workload to it.
