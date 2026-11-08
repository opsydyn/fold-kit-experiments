# Zloz naming migration — local qualification

- **result:** complete
- **claim:** The four-package Zloz family, preferred public APIs, main README, demo workspace, generated API title/navigation and release identities are migrated locally. Flow-named publication is explicitly rejected; obsolete release PR #110 was closed.
- **evidence:** Repository check/typecheck/tests/build, workbench build, desktop/mobile editing journeys, pinned legacy-code audit, generated six-module TypeDoc browser check and production-prefix promo artifact test passed. [API screenshot](../../apps/zloz-promo/evidence/naming-api-light.png) and [browser receipt](../../apps/zloz-promo/evidence/naming-api-browser.json).
- **remaining uncertainty:** This receipt covers local qualification. Protected-PR CI and hosted acceptance are separate delivery evidence. npm publication is neither performed nor authorized. The production Effect CLI remains a subsequent slice.
- **next:** Review and merge the naming migration through protected CI, then verify deployed API/docs links; implement the standalone Effect CLI separately.

## Verified boundaries

- `@opsydyn/foldkit-zloz`, `-elk`, `-force` and `-mermaid` install as renamed tarballs in clean consumers; existing Node/Bun and TypeScript qualification remains active.
- Deprecated source aliases share constructor, view and cache identity with canonical APIs. Graph version 1, Mermaid `flowId` and protocol, storage keys and DOM/theme input hooks retain their spelling and behavior.
- Literal version-one architecture fixtures survive editing and Undo. The pinned `ce978a2` legacy reader still reads, edits, copies and round-trips the fixture. Its original Git-tree path is deliberately retained by the audit.
- Canonical docs are **Foldkit Zloz API**, including Core, FoldKit, ELK, Force, ForceEligibility and Mermaid. Browser checks observed all six modules with no page errors. Production-path tests passed 54 assertions.
- Publication identity tests reject all four old package names and mismatched artifacts; release configuration contains only the four Zloz graph identities. No npm publish workflow was dispatched.
- Architecture/delivery/test self-review is recorded in [ADR 0015](../adr/0015-migrate-the-public-package-family-to-zloz.md). Captured historical evidence is preserved; active harness paths move with their owners. Unrelated local files are excluded.

Recommendation: **merge** after protected CI passes. Effect CLI (`effect/cli` in
Effect 4) is a recorded production requirement, not a claim that the historical
imperative fidelity driver has already been replaced.
