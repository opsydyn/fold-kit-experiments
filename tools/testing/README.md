# Testing Effect and FoldKit workspaces

The web and Zloz demo workspaces use Vitest 5. Each workspace config chooses its test files and environment. The web app uses happy-dom and its CSS transform. The Zloz demo runs in Node.

Each workspace's Vitest setup file imports `@opsydyn/testing/foldkit`. This registers FoldKit's Scene matchers and makes their types available to the workspace test compiler. Consumers declare the private package as a workspace dev dependency and use the `foldkit-vitest` Moon tag so changes here invalidate their cached checks.

- Use plain assertions for pure functions and individual update decisions.
- Use `Story.story` to send a sequence of messages through the real update function and check model or command outcomes. See the resize and return-to-present test in [history.test.ts](../../apps/zloz-demo/test/history.test.ts).
- Use `Scene.scene` to drive a rendered control by its accessible role and check what the user sees. Resolve commands explicitly at this boundary. Exercise the actual command with `it.effect` when its result matters. [bootstrap.test.ts](../../apps/zloz-demo/test/bootstrap.test.ts) covers both the allocation command and the retry UI.
- Use a browser or runtime integration test for real ports, layout, canvas output or cross-client behavior.

From the repository root, run `bun moon run zloz-demo:test` or `bun moon run web:test` to build dependencies and run the workspace suite.
