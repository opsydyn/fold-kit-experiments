# Biome → oxlint + oxfmt Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Biome (formatter + linter) with oxfmt (formatter) + oxlint (linter), swapping `@catenarycloud/linteffect` GritQL rules for `@opsydyn/oxlint-effect` and adding `@foldkit/oxlint-plugin`.

**Architecture:** oxfmt handles all formatting from a `.oxfmtrc.json` at the workspace root. oxlint handles linting via `oxlint.config.ts` (TypeScript format), composing the `recommended` preset from `@opsydyn/oxlint-effect` with the `@foldkit/oxlint-plugin` JS plugin and explicit biome rule equivalents. Root `package.json` scripts drive both tools across the entire bun monorepo.

**Tech Stack:** bun workspaces, oxlint, oxfmt, @opsydyn/oxlint-effect@0.4.0 (84 Effect TS rules), @foldkit/oxlint-plugin@0.2.0 (8 foldkit rules)

## Global Constraints

- bun ≥ 1.3.11 (existing)
- node ≥ 22.12.0 (existing)
- Single root-level lint/format config — no per-package overrides unless a package explicitly needs them
- Formatter output must match current biome settings: 2-space indent, 100-char line width, single quotes, trailing commas (all), always semicolons
- All 27 rule behaviours from the previous `@catenarycloud/linteffect` GritQL set must be covered by the `recommended` preset (they are — verified by cross-referencing rule lists)
- No `biome.json` or `@biomejs/biome` should remain after Task 6

---

### Task 1: Install new toolchain, remove Biome

**Files:**

- Modify: `package.json` (root)

**Interfaces:**

- Produces: `oxlint`, `oxfmt`, `@opsydyn/oxlint-effect`, `@foldkit/oxlint-plugin` available in `node_modules`

- [ ] **Step 1: Install new packages**

```bash
bun add -d oxlint oxfmt @opsydyn/oxlint-effect @foldkit/oxlint-plugin
```

- [ ] **Step 2: Remove old packages**

```bash
bun remove @biomejs/biome @catenarycloud/linteffect
```

- [ ] **Step 3: Verify installs**

```bash
bunx oxlint --version
bunx oxfmt --version
```

Expected: version strings printed for both (no "command not found" errors).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: replace biome + linteffect with oxlint + oxfmt + oxlint-effect"
```

---

### Task 2: Create oxfmt formatter config

**Files:**

- Create: `.oxfmtrc.json`
- Create: `.oxfmtignore`

**Interfaces:**

- Produces: oxfmt configured to match previous biome formatter output (100-char width, 2-space indent, single quotes, always semis, trailing commas all)

- [ ] **Step 1: Create `.oxfmtrc.json`**

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all"
}
```

- [ ] **Step 2: Create `.oxfmtignore`**

```
dist/
artifacts/
docs/
node_modules/
```

- [ ] **Step 3: Run format check on existing code**

```bash
bunx oxfmt --check .
```

Expected: either "All files formatted correctly" or a diff listing files that would change. Note the count — these will be rewritten in Task 3. A non-zero count is normal because biome and oxfmt have minor output differences despite both being Prettier-compatible.

- [ ] **Step 4: Commit**

```bash
git add .oxfmtrc.json .oxfmtignore
git commit -m "chore: add oxfmt config matching biome formatter settings"
```

---

### Task 3: Reformat codebase with oxfmt

**Files:**

- Modify: all `*.ts`, `*.mts`, `*.js`, `*.mjs`, `*.json` files not excluded by `.oxfmtignore`

**Interfaces:**

- Consumes: `.oxfmtrc.json` from Task 2
- Produces: all source files formatted per new config; `oxfmt --check .` exits 0

- [ ] **Step 1: Run oxfmt on entire workspace**

```bash
bunx oxfmt .
```

Expected: oxfmt rewrites files whose formatting differs from `.oxfmtrc.json` and prints the list of changed files.

- [ ] **Step 2: Run typecheck to catch regressions**

```bash
bun run typecheck
```

Expected: zero TypeScript errors. Formatting cannot cause type errors; any errors here are pre-existing.

- [ ] **Step 3: Verify format check now passes**

```bash
bunx oxfmt --check .
```

Expected: exits 0 with no diff output.

- [ ] **Step 4: Commit reformatted files**

```bash
git add -A
git commit -m "chore: reformat codebase with oxfmt"
```

---

### Task 4: Create oxlint config

**Files:**

- Create: `oxlint.config.ts`

**Interfaces:**

- Consumes: `recommended` from `@opsydyn/oxlint-effect`, `@foldkit/oxlint-plugin`
- Produces: `oxlint.config.ts` wiring up TypeScript plugin, 84 Effect rules (recommended preset), 8 foldkit rules, and exact biome rule equivalents

- [ ] **Step 1: Create `oxlint.config.ts`**

```typescript
import { defineConfig } from 'oxlint';
import { recommended } from '@opsydyn/oxlint-effect';

export default defineConfig({
  plugins: ['typescript'],
  jsPlugins: [...recommended.jsPlugins, { name: 'foldkit', specifier: '@foldkit/oxlint-plugin' }],
  rules: {
    ...recommended.rules,

    // Foldkit application conventions
    'foldkit/no-noop-message': 'error',
    'foldkit/got-submodel-message-name': 'error',
    'foldkit/message-binding-matches-tag': 'error',
    'foldkit/got-prefix-requires-submodel-payload': 'error',
    'foldkit/no-empty-object-tagged-call': 'error',
    'foldkit/prefer-callable-message-constructor': 'error',
    'foldkit/command-binding-matches-name': 'error',
    'foldkit/no-module-level-mutable-state': 'error',

    // Biome rule equivalents — preserve the exact severities from biome.json
    '@typescript-eslint/no-explicit-any': 'off',
    'no-cond-assign': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-constant-condition': 'warn',
  },
  ignorePatterns: ['**/dist/**', '**/artifacts/**', '**/docs/**', '**/node_modules/**'],
});
```

- [ ] **Step 2: Run oxlint to collect baseline violations**

```bash
bunx oxlint . 2>&1 | tee /tmp/oxlint-baseline.txt
echo "Total violation lines: $(grep -c 'error\|warning' /tmp/oxlint-baseline.txt)"
```

Expected: oxlint runs. The `recommended` preset (84 rules) is a strict superset of the 27 previous GritQL rules, so new violations are expected. Capture the output for Task 5 triage.

- [ ] **Step 3: Commit config**

```bash
git add oxlint.config.ts
git commit -m "chore: add oxlint config with oxlint-effect recommended + foldkit plugin"
```

---

### Task 5: Triage lint violations from expanded rule set

**Files:**

- Modify: `oxlint.config.ts` (to downgrade rules that are too noisy for this codebase)
- Modify: source files with auto-fixable violations

**Interfaces:**

- Consumes: `/tmp/oxlint-baseline.txt` from Task 4
- Produces: `bunx oxlint .` exits with code 0 (warnings allowed, zero errors)

- [ ] **Step 1: Group violations by rule name**

```bash
grep -oP '\[.*?\]' /tmp/oxlint-baseline.txt | sort | uniq -c | sort -rn | head -30
```

This prints the top violation rules by frequency. Review every rule that appears as `error`.

- [ ] **Step 2: Apply auto-fixes**

```bash
bunx oxlint --fix .
```

Expected: oxlint fixes auto-fixable violations in place and reports how many were fixed.

- [ ] **Step 3: Re-run typecheck after auto-fixes**

```bash
bun run typecheck
```

Expected: zero TypeScript errors.

- [ ] **Step 4: Downgrade rules that are legitimately noisy for this codebase**

For each rule still showing errors after auto-fix, open `oxlint.config.ts` and add an override. Rules to downgrade are those that:

- Fire across many files due to deliberate style choices (e.g. `no-if-statement`, `no-ternary` in non-Effect code)
- Are not a priority to fix before shipping the migration

Add overrides in the `rules` block after the spread:

```typescript
rules: {
  ...recommended.rules,
  // foldkit rules (unchanged from Step 1) ...
  // biome equivalents (unchanged from Step 1) ...

  // Rules downgraded to warn during migration — revisit before next major release
  "linteffect/no-if-statement": "warn",
  "linteffect/no-ternary": "warn",
  // ... only add lines for rules that actually fired on this codebase
},
```

Do not add overrides for rules with zero violations. Do not add overrides for foldkit plugin rules.

- [ ] **Step 5: Verify zero errors**

```bash
bunx oxlint .
echo "Exit code: $?"
```

Expected: exit code 0. Warnings in the output are acceptable.

- [ ] **Step 6: Commit**

```bash
git add oxlint.config.ts
git add $(git diff --name-only)
git commit -m "chore: triage oxlint violations, downgrade noisy rules to warn"
```

---

### Task 6: Update root package.json scripts, remove biome.json

**Files:**

- Modify: `package.json` (root `scripts` section)
- Delete: `biome.json`

**Interfaces:**

- Produces: `bun run check` runs oxlint + oxfmt --check; `bun run check:fix` runs oxfmt then oxlint --fix; biome.json is gone

- [ ] **Step 1: Update `package.json` scripts**

Replace:

```json
"check": "biome check .",
"check:fix": "biome check --write ."
```

With:

```json
"check": "oxlint . && oxfmt --check .",
"check:fix": "oxfmt . && oxlint --fix ."
```

- [ ] **Step 2: Check for CI references to biome**

```bash
grep -r "biome" .github/ 2>/dev/null || echo "no .github directory"
grep -rl "biome" . --include="*.yml" --include="*.yaml" 2>/dev/null || echo "no yaml references to biome"
```

If any CI workflow files reference biome, update those files:

- Replace `biome check .` with `bun run check`
- Replace `biome check --write .` with `bun run check:fix`

- [ ] **Step 3: Delete `biome.json`**

```bash
git rm biome.json
```

- [ ] **Step 4: Run full check**

```bash
bun run check
```

Expected: both oxlint and oxfmt --check pass with exit code 0.

- [ ] **Step 5: Run typecheck**

```bash
bun run typecheck
```

Expected: zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "chore: switch check scripts to oxlint + oxfmt, remove biome.json"
```

---

## Self-Review

**Spec coverage:**

- [x] Remove `@biomejs/biome` → Task 1 Step 2, Task 6 Step 3
- [x] Install `oxlint` + `oxfmt` → Task 1 Step 1
- [x] Create oxfmt config matching biome formatter → Task 2
- [x] Reformat codebase → Task 3
- [x] Replace `@catenarycloud/linteffect` with `@opsydyn/oxlint-effect` → Task 1 + Task 4
- [x] Configure `@opsydyn/oxlint-effect` recommended (84 rules) → Task 4
- [x] Add `@foldkit/oxlint-plugin` (8 rules) → Task 1 + Task 4
- [x] Preserve exact Biome lint rule severities → Task 4 Step 1 (biome equivalents block)
- [x] Handle expanded rule set violations from recommended → Task 5
- [x] Update root package.json scripts → Task 6 Step 1
- [x] Check and update CI files → Task 6 Step 2
- [x] Delete biome.json → Task 6 Step 3

**Placeholder scan:** No TBDs. Task 5 Step 4 gives a concrete code template for the triage override pattern.

**Type consistency:** `defineConfig`, `recommended`, `jsPlugins`, `rules` are consistent across Task 4 Steps 1 and 2, and Task 5 Step 4.
