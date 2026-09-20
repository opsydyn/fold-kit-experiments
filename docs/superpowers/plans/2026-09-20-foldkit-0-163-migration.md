# FoldKit 0.163 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all three active workspaces to FoldKit 0.163 and Effect rc.116, then prove the new Astro document and SSR contracts without weakening the package boundaries.

**Architecture:** Keep `apps/web` responsible for canonical URL policy, boot fixtures, and any future pointer interaction. Keep `@opsydyn/astro-foldkit` responsible for server/client document handoff and Astro lifecycle, and keep `@opsydyn/foldkit-viz` pure and framework-free. Consume actual 0.162/0.163 API changes only where the repository has real usages; do not add release-tour examples.

**Tech Stack:** Bun workspaces, FoldKit `0.163.0`, Effect `4.0.0-rc.116`, Astro `7.1.1`, TypeScript `6.0.3`, `@foldkit/vite-plugin` `0.24.0`, Vitest, `bun:test`, Oxlint, Oxfmt, and the existing Astro Cloudflare build.

**Spec:** `docs/superpowers/specs/2026-09-20-foldkit-0-163-migration-design.md`

## Global Constraints

- Target FoldKit `0.163.0` in all direct workspace consumers.
- Target Effect `4.0.0-rc.116` and the matching `@effect/platform-browser` release.
- Target `@foldkit/vite-plugin` `0.24.0` after confirming its peer metadata.
- Use the Oxlint FoldKit plugin release whose metadata supports FoldKit 0.163; do not weaken rules to hide incompatibility.
- Keep canonical URL selection application-owned; never infer canonical URLs from `Astro.url` or browser location.
- Keep `@opsydyn/foldkit-viz` free of runtime dependencies on FoldKit, Effect, Astro, HTTP, Machine, and Port APIs.
- Do not add synthetic `keyBindings`, `EntryGates`, `Stream.mapBoth`, or `modifyFields` examples.
- Leave `Subscription.animationFrame({ toMessage })` and `Subscription.lift({ toParentMessage })` unchanged.
- Defer pointer-identity interaction changes to a later visual slice.
- Do not rewrite historical migration specs, plans, or generated changelogs.
- Use `bun run check` for the repository lint/format gate; Biome is not part of this repository.

## Review Focus

- **Canonical with omitted `ogUrl`:** an explicit `Document.canonical` must preserve FoldKit 0.163's canonical/`ogUrl` semantics. Test this in `packages/astro-foldkit/test/unit/server-document.test.ts`.
- **No metadata inference:** a page that omits canonical, language, and direction must remain free of those fields. Retain and extend the omission test in `packages/astro-foldkit/test/unit/server-document.test.ts`.
- **SSR artifact shape:** the server build must omit the unrendered root `dist/client/index.html` while retaining `greeting-static/index.html`. Test this in `packages/astro-foldkit/test/integration/astro-page-smoke.test.ts`.
- **Inbound message during boot:** an inbound Stateflow Port event sent immediately after `Runtime.embed` must be processed once after boot. Test this in `apps/web/src/apps/stateflow/main.scene.test.ts`.
- **Package boundary compatibility:** packed server imports, consumer typechecking, FoldKit record types, and the final old-API search must remain green. Test this through `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`, `packages/foldkit-viz/test/foldkit-compatibility.test.ts`, and the final workspace audit.

---

### Task 1: Establish the FoldKit 0.163 dependency contract

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/astro-foldkit/package.json`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `package.json` only if the current `@foldkit/oxlint-plugin` metadata rejects FoldKit 0.163
- Modify: `bun.lock`

**Interfaces:**
- Consumes: the approved 0.163 dependency contract and the registry peer metadata for the Vite/Oxlint FoldKit plugins.
- Produces: one resolved FoldKit `0.163.0` line, Effect rc.116 line, compatible Vite/Oxlint tooling, and package peer ranges that reject the tested-incompatible FoldKit 0.161 line.

- [ ] **Step 1: Capture the baseline before changing manifests.**

  Run:

  ```sh
  bun typecheck
  bun run check
  bun run test
  ```

  Record the exit status and the existing error summary in the task notes. Do not fix unrelated baseline failures in this task.

- [ ] **Step 2: Verify upstream peer metadata.**

  Run:

  ```sh
  bunx npm view @foldkit/vite-plugin@0.24.0 peerDependencies --json
  bunx npm view @foldkit/oxlint-plugin version peerDependencies --json
  ```

  Confirm that the selected Vite plugin accepts FoldKit 0.163 and Effect rc.116. `@foldkit/vite-plugin@0.24.0` is the selected release because its published peer metadata accepts rc.116. Keep `@foldkit/oxlint-plugin@0.14.0` if its metadata accepts the target; otherwise select the first registry release whose peer metadata accepts FoldKit 0.163 and record that concrete version in the root manifest.

- [ ] **Step 3: Update direct dependencies.**

  Set these manifest values:

  ```json
  {
    "foldkit": "0.163.0",
    "effect": "4.0.0-rc.116",
    "@effect/platform-browser": "4.0.0-rc.116",
    "@foldkit/vite-plugin": "^0.24.0"
  }
  ```

  Apply them to the existing locations in `apps/web/package.json` and the relevant dependency/devDependency locations in both published packages. Do not add `@effect/platform-browser` to either published package unless an existing import requires it.

- [ ] **Step 4: Raise package peer floors.**

  In `packages/astro-foldkit/package.json`, change the FoldKit peer range to:

  ```json
  "foldkit": ">=0.163.0 <0.164.0"
  ```

  In `packages/foldkit-viz/package.json`, change the peer ranges to:

  ```json
  "effect": ">=4.0.0-rc.116 <5.0.0",
  "foldkit": ">=0.163.0 <0.164.0"
  ```

  Keep the existing optional-peer policy and the existing Astro peer range.

- [ ] **Step 5: Resolve and inspect the lockfile.**

  Run:

  ```sh
  bun install
  bun pm ls --all | rg -n "foldkit|effect|platform-browser|vite-plugin|oxlint-plugin"
  rg -n "foldkit@0\.163\.0|effect@4\.0\.0-rc\.116|platform-browser.*rc\.116|vite-plugin.*0\.24" bun.lock
  ```

  Expected: no workspace resolves FoldKit 0.161 or Effect rc.115, and no incompatible peer override is present.

- [ ] **Step 6: Build the two published packages against the new contract.**

  Run:

  ```sh
  bun run --filter @opsydyn/foldkit-viz build
  bun run --filter @opsydyn/astro-foldkit build
  ```

  Expected: both builds succeed before any source migration is attempted.

- [ ] **Step 7: Commit the dependency contract.**

  ```sh
  git add package.json apps/web/package.json packages/astro-foldkit/package.json packages/foldkit-viz/package.json bun.lock
  git commit -m "build: align workspace with FoldKit 0.163"
  ```

### Task 2: Audit renamed APIs and update compatibility coverage

**Files:**
- Modify: `packages/foldkit-viz/test/foldkit-compatibility.test.ts`
- Modify: any application/package source file only if the audit finds a real 0.162/0.163 renamed API usage
- Test: `packages/astro-foldkit/test/integration/package-import-smoke.test.ts`

**Interfaces:**
- Consumes: the dependency and peer contract from Task 1.
- Produces: a source tree with no obsolete 0.162/0.163 names and compatibility tests labelled for FoldKit 0.163.

- [ ] **Step 1: Run the post-install API audit.**

  Run:

  ```sh
  rg -n "\bevo\b|makeConstrainedEvo|keyboardShortcuts|fromEventFilterMap|fromEventFilterMapPreventDefault|\.fromEvent\(|Stream\.mapBoth|onSuccess|onFailure|shortcut:" apps packages --glob '!packages/foldkit-viz/docs/**' --glob '!**/dist/**'
  ```

  Expected: no active source hits for the renamed APIs. Do not edit `animationFrame` `toMessage` or `Subscription.lift` `toParentMessage` results.

- [ ] **Step 2: Migrate any real hits using the 0.163 names.**

  Use this exact mapping if the audit or typecheck exposes a hit:

  ```text
  evo                     -> modifyFields
  makeConstrainedEvo      -> makeModifyFieldsFor
  keyboardShortcuts       -> keyBindings
  shortcut                -> keys
  Subscription.fromEvent  mapper -> mapEvent
  filter-map event mapper -> filterMapEvent
  Stream.mapBoth onSuccess -> onElement
  Stream.mapBoth onFailure -> onError
  ```

  Keep the existing constructor, model, and message ownership. Do not introduce a wrapper that supports both names.

- [ ] **Step 3: Update the viz compatibility test label and keep the record assertion.**

  In `packages/foldkit-viz/test/foldkit-compatibility.test.ts`, change the suite description to:

  ```ts
  describe('FoldKit 0.163 document compatibility', () => {
  ```

  Keep the `TextDirection` decoding assertion and the `Return<Model, never>` record assertion. The test must still prove that `commands` is optional when omitted.

- [ ] **Step 4: Run focused type and package tests.**

  ```sh
  bun run --filter @opsydyn/foldkit-viz typecheck
  bun run --filter @opsydyn/foldkit-viz test -- test/foldkit-compatibility.test.ts
  bun run --filter @opsydyn/astro-foldkit typecheck
  bun run --filter @opsydyn/astro-foldkit test -- test/integration/package-import-smoke.test.ts
  ```

  Expected: the pure viz package has no new runtime dependency and the packed Astro consumer still resolves `@opsydyn/astro-foldkit/server` under Bun and Node.

- [ ] **Step 5: Commit the API audit result.**

  ```sh
  git add packages/foldkit-viz/test/foldkit-compatibility.test.ts packages/astro-foldkit/test/integration/package-import-smoke.test.ts
  git commit -m "test: verify FoldKit 0.163 API compatibility"
  ```

  If Step 2 changed a source file, add that exact file path to the command. Do not stage generated `dist` or test artifact directories.

### Task 3: Pin the Astro document metadata contract

**Files:**
- Modify: `packages/astro-foldkit/test/unit/server-document.test.ts`
- Modify: `packages/astro-foldkit/src/server-document.ts` only if the focused test proves the adapter loses the 0.163 canonical/`ogUrl` result
- Modify: `packages/astro-foldkit/README.md`

**Interfaces:**
- Consumes: `RenderedApplication` metadata from FoldKit 0.163.
- Produces: `resolvePageDocument` behaviour that preserves explicit canonical metadata, preserves the upstream canonical-to-`ogUrl` fallback, and leaves omitted metadata absent.

- [ ] **Step 1: Refactor the fixture and add the canonical-only contract test.**

  Change the existing `pageConfig` constant into a `makePageConfig(metadata)` helper whose `view` spreads the supplied metadata into the returned `Document`. Use a model-based metadata factory so the existing default URL remains unchanged. The helper must use this shape:

  ```ts
  type PageMetadata = Pick<Document, 'canonical' | 'ogUrl'>;
  type MetadataFactory = (model: Model) => PageMetadata;

  const makePageConfig = (
    metadata: MetadataFactory = (model) => ({
      canonical: '',
      ogUrl: `https://example.com${model.pathname}`,
    }),
  ) => ({
    Flags,
    Model: {},
    init: (flags: Flags) => ({ model: flags, commands: [{ _tag: 'IgnoredCommand' }] }),
    update: (model: Model, _message: Message) => ({ model }),
    view: (model: Model, h: HtmlBuilder<Message>): Document => ({
      title: `Server page ${model.locale}`,
      lang: model.locale,
      dir: textDirectionByLocale[model.locale] ?? 'Auto',
      ...metadata(model),
      body: h.section([], [`${model.locale}:${model.pathname}:${model.routeLocale ?? 'missing'}`]),
    }),
  } satisfies PageConfig<Flags, Model, Message>);

  const makePage = (metadata?: MetadataFactory) =>
    definePage<{ readonly locale: string; readonly noMeta?: boolean | '' }, Flags>(
      () => Promise.resolve(makePageConfig(metadata)),
      {
        flags: ({ request, url, params, props }) => ({
          locale: props.locale,
          pathname: `${request.method}:${url.pathname}`,
          routeLocale: params.locale,
          noMeta: shouldSkipMetadata(props),
        }),
      },
    );
  ```

  Preserve the existing fixture's title, language, direction, body, and flag derivation inside `makePageConfig`. A canonical-only page is then `makePage(() => ({ canonical: 'https://example.com/ar/dashboard' }))` evaluated with the existing `context` value. Add this assertion:

  ```ts
  it('preserves canonical semantics when the page omits ogUrl', async () => {
    process.env.FOLDKIT_BUILD_ID = 'resolver-build';

    const resolved = await resolvePageDocument(
      makePage(() => ({ canonical: 'https://example.com/ar/dashboard' })),
      context,
    );

    expect(resolved.canonical).toBe('https://example.com/ar/dashboard');
    expect(resolved.ogUrl).toBe('https://example.com/ar/dashboard');
  });
  ```

  Reuse the existing `Flags`, `PageConfig`, and context helpers rather than creating a second test harness. The test must exercise `resolvePageDocument`, not only a hand-built adapter record.

- [ ] **Step 2: Run the focused test and inspect the actual failure.**

  ```sh
  bun run --filter @opsydyn/astro-foldkit test -- test/unit/server-document.test.ts
  ```

  This establishes whether FoldKit 0.163 already supplies the fallback through `RenderedApplication` or whether the Astro adapter loses it.

- [ ] **Step 3: Make the smallest adapter correction if required.**

  If the focused test shows that the upstream `RenderedApplication` contains the expected fallback, leave `packages/astro-foldkit/src/server-document.ts` unchanged. If it shows that the adapter receives `canonical` without `ogUrl`, preserve the 0.163 contract at this boundary by changing only the optional metadata mapping so `ogUrl` falls back to the explicit canonical value; never derive either value from `PageContext.url`.

- [ ] **Step 4: Retain the omission and `noMeta` tests.**

  Confirm the existing omission test still expects exactly `{ title: 'Only title en' }` and that the `noMeta` test still proves island metadata suppression does not suppress server document metadata.

- [ ] **Step 5: Document the application-owned URL rule.**

  In the server-rendering section of `packages/astro-foldkit/README.md`, add a short “Canonical metadata” paragraph with this contract:

  ```text
  definePage does not infer a canonical URL from Astro.url, route parameters, or the browser location. The page view must return Document.canonical when the application has a canonical identity. Query parameters and alternate representations remain application-owned. When FoldKit supplies the 0.163 canonical-to-ogUrl fallback, the resolver passes it through unchanged.
  ```

- [ ] **Step 6: Run the unit and greeting metadata tests.**

  ```sh
  bun run --filter @opsydyn/astro-foldkit test -- test/unit/server-document.test.ts
  bun run --filter @opsydyn/web test -- src/apps/greeting/main.page.test.ts
  ```

  Expected: explicit greeting canonical/`ogUrl`, canonical-only fallback, omitted metadata, and `noMeta` behaviour all pass.

- [ ] **Step 7: Commit the document contract.**

  ```sh
  git add packages/astro-foldkit/src/server-document.ts packages/astro-foldkit/test/unit/server-document.test.ts packages/astro-foldkit/README.md
  git commit -m "test: codify FoldKit document metadata semantics"
  ```

### Task 4: Cover SSR artifact output and boot-time subscription buffering

**Files:**
- Modify: `packages/astro-foldkit/test/integration/astro-page-smoke.test.ts`
- Modify: `apps/web/src/apps/stateflow/main.scene.test.ts`

**Interfaces:**
- Consumes: the upgraded Astro renderer, existing `greeting-static` page, existing Stateflow replay Port, and existing runtime test harness.
- Produces: integration evidence for the 0.163 SSR output change and an app-level regression test for an inbound Port message arriving immediately after embed.

- [ ] **Step 1: Add a build-output existence helper to the Astro smoke test.**

  Extend the existing `node:fs/promises` imports with `access` and add:

  ```ts
  const fileExists = async (file: string): Promise<boolean> => {
    try {
      await access(file);
      return true;
    } catch {
      return false;
    }
  };
  ```

- [ ] **Step 2: Add the root-template regression assertions.**

  Immediately after the existing `bun run build` call in `astro-page-smoke.test.ts`, assert:

  ```ts
  expect(await fileExists(path.join(webDir, 'dist', 'client', 'index.html'))).toBe(false);
  expect(
    await fileExists(path.join(webDir, 'dist', 'client', 'greeting-static', 'index.html')),
  ).toBe(true);
  ```

  Keep the existing static HTML metadata assertions; they prove that removing the unrendered root template did not remove valid prerendered output.

- [ ] **Step 3: Add an early inbound Port test.**

  In `apps/web/src/apps/stateflow/main.scene.test.ts`, add a test that uses the existing `Runtime.embed` setup, sends `fixture[0]` immediately after `Runtime.embed` returns, and waits for the app-owned update recorder to observe exactly one `Message.ReceivedReplayEvent`:

  ```ts
  it('processes an inbound replay event sent during runtime boot', async () => {
    const received: AppMessage[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const handle = Runtime.embed(
      Runtime.makeElement({
        Model,
        init: () => ({ model: initModel }),
        update: (model, message) => (received.push(message), update(model, message)),
        view: (_model, h) => h.div([], []),
        subscriptions,
        ports: { inbound: { replay: ReplayEventPort } },
        container,
      }),
    );

    handle.ports.replay.send(fixture[0]);

    await vi.waitFor(() => {
      expect(received).toEqual([Message.ReceivedReplayEvent({ event: fixture[0] })]);
    });

    handle.dispose();
    container.remove();
  });
  ```

  Keep the existing telemetry test as the outbound Port/Command coverage. This test intentionally does not introduce a ManagedResource fixture because the application has no current managed resource; it pins the repository's actual boot-time Subscription/Port path.

- [ ] **Step 4: Run the focused integration tests.**

  ```sh
  bun run --filter @opsydyn/web test -- src/apps/stateflow/main.scene.test.ts
  bun run --filter @opsydyn/astro-foldkit test -- test/integration/astro-page-smoke.test.ts
  ```

  Expected: Stateflow processes the early replay once, and the Astro production build has no unrendered root template while retaining static greeting output.

- [ ] **Step 5: Commit the lifecycle and SSR coverage.**

  ```sh
  git add apps/web/src/apps/stateflow/main.scene.test.ts packages/astro-foldkit/test/integration/astro-page-smoke.test.ts
  git commit -m "test: cover FoldKit 0.163 boot and SSR changes"
  ```

### Task 5: Refresh current compatibility guidance

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/roadmap.md`
- Modify: `packages/astro-foldkit/README.md`
- Modify: `packages/foldkit-viz/README.md`
- Modify: `packages/foldkit-viz/test/foldkit-compatibility.test.ts` only if Task 2 did not already update its suite label

**Interfaces:**
- Consumes: the tested versions and behaviour from Tasks 1-4.
- Produces: repository guidance that describes the current FoldKit 0.163 contract without rewriting historical migration records.

- [ ] **Step 1: Update agent guidance.**

  In `AGENTS.md`, change the stack line to FoldKit `0.163.0` and Effect `4.0.0-rc.116`. Keep the existing named-import, record-return, no-inline-runtime, and no-dynamic-import guidance.

  In `CLAUDE.md`, replace the stale “Currently on `foldkit@0.126.0`” section with current 0.163 guidance. Retain the useful named-export and `foldkit/http` notes, and add the 0.163 names only as migration guidance: `modifyFields`, `keyBindings`, `mapEvent`, and `filterMapEvent`. State explicitly that existing `animationFrame.toMessage` and `lift.toParentMessage` remain valid. Also change the old tuple-shaped `Step` example to the current record form, omitting `commands` when no commands are produced.

- [ ] **Step 2: Update package documentation.**

  In `packages/astro-foldkit/README.md`, update the compatibility paragraph and peer-dependency table to FoldKit `0.163.x`, Effect rc.116 where mentioned, and Vite plugin `0.24.x`. Keep the canonical metadata paragraph from Task 3.

  In `packages/foldkit-viz/README.md`, update the compatibility line to FoldKit `0.163.x` and preserve the statements that the package is framework-free, pure, and does not own server or remote-data policy.

- [ ] **Step 3: Update the current roadmap target.**

  In `docs/roadmap.md`, change only the current compatibility paragraph from FoldKit 0.161/Effect rc.115/Vite plugin 0.22 to the tested 0.163/rc.116/0.24 line. Leave historical 0.136 and Stateflow entries intact.

- [ ] **Step 4: Check for stale active guidance.**

  Run:

  ```sh
  rg -n "0\.126\.0|0\.161\.0|0\.161\.x|rc\.115|0\.22\.x|keyboardShortcuts|makeConstrainedEvo|fromEventFilterMap" AGENTS.md CLAUDE.md README.md apps packages docs/roadmap.md --glob '!packages/foldkit-viz/docs/**' --glob '!docs/superpowers/**' --glob '!**/dist/**'
  ```

  Expected: no stale active compatibility statement remains. Historical migration documents are excluded deliberately.

- [ ] **Step 5: Commit the guidance update.**

  ```sh
  git add AGENTS.md CLAUDE.md docs/roadmap.md packages/astro-foldkit/README.md packages/foldkit-viz/README.md packages/foldkit-viz/test/foldkit-compatibility.test.ts
  git commit -m "docs: update FoldKit 0.163 guidance"
  ```

### Task 6: Run the release qualification gates

**Files:**
- Modify: none unless a focused verification exposes a defect in the preceding task
- Test: all workspace package tests, typechecks, lint/format checks, builds, and packed-consumer smoke tests

**Interfaces:**
- Consumes: all committed migration tasks.
- Produces: a clean, verified branch ready for a separate package version/release decision; this task does not publish or push.

- [ ] **Step 1: Run focused package checks.**

  ```sh
  bun run --filter @opsydyn/foldkit-viz check
  bun run --filter @opsydyn/foldkit-viz typecheck
  bun run --filter @opsydyn/foldkit-viz test
  bun run --filter @opsydyn/astro-foldkit check
  bun run --filter @opsydyn/astro-foldkit typecheck
  bun run --filter @opsydyn/astro-foldkit test
  ```

- [ ] **Step 2: Run the web app checks and builds.**

  ```sh
  bun run --filter @opsydyn/web check
  bun run --filter @opsydyn/web typecheck
  bun run --filter @opsydyn/web test
  bun run --filter @opsydyn/web build
  ```

- [ ] **Step 3: Run the repository gates.**

  ```sh
  bun run check
  bun typecheck
  bun run test
  ```

  Expected: all three commands exit 0. Use the workspace script `bun run test` so the gate runs the active workspaces rather than traversing the vendored `foldkit-main` checkout.

- [ ] **Step 4: Inspect the final package surface.**

  ```sh
  (cd packages/astro-foldkit && bun pm pack --dry-run)
  (cd packages/foldkit-viz && bun pm pack --dry-run)
  git diff --check origin/main...HEAD
  git status --short --branch
  ```

  Confirm that package tarballs include the documented exports and no generated `dist`, `artifacts`, or temporary smoke files are left as untracked changes.

- [ ] **Step 5: Review the complete diff before release work.**

  ```sh
  git log --oneline --decorate -6
  git diff --stat origin/main...HEAD
  git diff origin/main...HEAD -- package.json apps/web/package.json packages/astro-foldkit/package.json packages/foldkit-viz/package.json packages/astro-foldkit/src packages/astro-foldkit/test packages/foldkit-viz/test apps/web/src/apps/stateflow AGENTS.md CLAUDE.md docs/roadmap.md
  ```

  Verify that the diff contains only the approved dependency, compatibility, canonical/SSR, boot-test, and documentation work. Package version bumps, changelog generation, tagging, and pushing are separate release actions.
