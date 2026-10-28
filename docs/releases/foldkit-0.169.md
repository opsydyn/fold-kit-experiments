# FoldKit 0.169 release notes

The workspace moves from FoldKit `0.167.0` to `0.169.0`, along with:

- `@foldkit/vite-plugin` `0.27` to `0.28`
- `@foldkit/devtools-mcp` `0.24.1` to `0.25.0`
- `@foldkit/ui` and `@foldkit/devtools` `0.167.0` to `0.169.0`

Effect stays at `4.0.0`. FoldKit 0.169 still declares exactly `effect@4.0.0` as its peer.

## What changed upstream

- **0.168.0** is a rebuild with FoldKit's shared tooling, with no API changes.
- **0.169.0** adds two APIs and a set of fixes:
  - `Transition.match`, `Transition.matchOrElse`, `Transition.isExiting` and
    `Transition.isStaying`, for route entry and exit policies
  - `Lazy.expectAllReused` in `foldkit/test`, to check lazy cache reuse
  - **Fixes:**
    - Inputs bound with `h.Value` and `h.OnInput` no longer drop typed characters when a
      render runs before queued Messages land.
    - Japanese, Chinese and Korean input methods now confirm through `OnKeyDown` and key
      bindings.
    - `Dom.inertOthers`, Mount reordering and Submodel teardown are fixed.
    - Server rendering does less CPU work.

Source:
[the FoldKit changelog](https://github.com/foldkit/foldkit/blob/main/packages/foldkit/CHANGELOG.md).

## What changed here

- **No source changes** were needed. The upgrade is versions, peer ranges and docs.
- **The published packages widen their FoldKit peer** so consumers on either line are
  accepted:

  | Package                         | Was                  | Now                  |
  | ------------------------------- | -------------------- | -------------------- |
  | `@opsydyn/astro-foldkit`        | `>=0.167.0 <0.168.0` | `>=0.167.0 <0.170.0` |
  | `@opsydyn/foldkit-viz`          | `>=0.167.0 <0.168.0` | `>=0.167.0 <0.170.0` |
  | `@opsydyn/effect-three-foldkit` | `0.167.0`            | `>=0.167.0 <0.170.0` |

  `astro-foldkit` now depends on `@foldkit/vite-plugin` `^0.28.0`.

- **The promo's downloadable projects** pin FoldKit `0.169.0` and the Vite plugin `0.28.0`.
- **Skills:** `skills/astro-foldkit` and its counter asset install the _published_
  `@opsydyn/astro-foldkit`. They stay on FoldKit 0.167 until a release with the widened
  peer is on npm.
