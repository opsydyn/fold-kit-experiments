# Native v2 authoring and portable review workbench

result: complete
claim: The local `/history/` workbench composes native package audit/patch/receipt/packet APIs without downgrading loose connections or replacing the working model with imported evidence.
evidence: Unit tests in `native-authoring-workbench.test.ts` and `native-authoring-files.test.ts`; mounted Playwright journey and JSON receipt below; real downloaded proposal/receipt/packet artifacts and inspected light/dark/390px screenshots.
remaining uncertainty: Local synthetic/browser evidence does not establish physical-device or manual assistive-technology acceptance, comprehensive SSR/hydration compatibility, performance budgets or all C1–C4 parity. Existing C4/DDD conversion authoring was not migrated; their native v2 receipts are inspectable. No npm publication, deployment or PR is included.
next: needs review; decide C2 coordinate/parent semantics and drawable group endpoints before implementing that contract.

## Delivered flow

A Command issues a distinct random page-session identity; only the model retains
it. Uninitialized sessions block authoring with a retry, and old-session proposals
are refused. Authoring binds proposals to model/session/revision/mode and shows provenance,
changes, authored losses and validation/protection reasons. Review and loss consent
are independent and content-bound. Apply calls the package engine again with live
policy and publishes editor/receipt together. Undo reverses the authored change in
one step; the retained receipt remains historical evidence.

Live DDD and EventStorming audits compare the chosen archive baseline with the
working checkpoint, retaining each mode. Their introduced/resolved/persisting
findings remain visible; untyped edges do not imply correctness. Portable review
reports Mermaid projection losses before permitting a current baseline-to-working
packet download. Changing source/baseline invalidates that permission.

Uploaded patch, C4 and DDD receipts and packets pass their strict native readers
before entering detached Before/After canvases. History ghosts retain the authored
difference. Recorded imported acceptance is not live Apply authority. Returning
restores the same working editor/Undo. Tokens and epochs isolate reads and canvas
events; model revision/epoch changes reject stale completions. Section changes
cancel pending reads. Reads reject oversized input before consuming it and reject
invalid UTF-8; downloads share the 1 MiB reopening budget. Effects stay in Commands.

## Local evidence

Run `node apps/zloz-demo/evidence/native-authoring-workbench-browser.mjs` against
`ZLOZ_NATIVE_URL` (default `http://127.0.0.1:4388`). The checked-in JSON records
assertions, viewports and page errors; it is a synthetic local receipt.

- [Browser assertions](native-authoring-workbench-browser.json) and [reproducible journey](native-authoring-workbench-browser.mjs).
- [Light](native-authoring-workbench-light.png), [dark](native-authoring-workbench-dark.png), [receipt comparison](native-authoring-workbench-receipt.png), [390px](native-authoring-workbench-narrow.png).
- [Downloaded patch receipt](native-authoring-workbench-receipt.json), [retained after Undo](native-authoring-workbench-retained.json), [loose-mode receipt](native-authoring-workbench-loose-receipt.json), [review packet](native-authoring-workbench-packet.json).

The mounted journey checks protection/consent, Apply, actual Blob downloads, file
reopening and working Undo. It also imports a real loose v2 model and confirms
input-to-input ordered edges remain unchanged, then opens literal C4/DDD native
receipts through the file controls. Screenshots were inspected after fixing form
spacing/theme and narrow header/input overflow. No page errors were observed.

## Verification

`bun run check`, `bun typecheck` and the full `bun run test` suite passed.
After the final host-boundary changes, the complete app Astro typecheck and full
workspace suite passed again. The focused authoring/file tests pass 12 cases and
86 assertions, including cross-page session identity and oversized generated
receipt failure without publishing a partial edit. An oversized example proposal
also reports a reason without changing the working model.

The first final browser attempt timed out reaching the edition-review return
control after workspace rebuilds. An isolated rendered-state inspection showed
the control present; the subsequent complete fresh-browser run passed without an
application change or page error. The checked-in receipt records that successful
run. This is local browser evidence, not a claim of comprehensive timing/device
qualification. Staged Moon verification is recorded with the commit handoff.
