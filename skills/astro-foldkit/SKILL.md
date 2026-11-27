---
name: astro-foldkit
description: Integrate Effect UI components into Astro, choose island activation and move an existing Astro FoldKit app to the standalone renderer.
---

# Astro Effect UI

Astro owns the page, request data, metadata and navigation. Effect UI owns each
component's model, messages and scope. Only public, serializable props and state
belong in the HTML sent to a browser.

Use the standalone package `@opsydyn/astro-effect-ui`. The Astro FoldKit
1.x package forwards the same integration and component adapter.
The previous runtime and its APIs remain in the published 0.x releases.

## Mount a component

1. Register the default integration from `@opsydyn/astro-effect-ui` in Astro.
2. Define the component with `Html.component` from `@effect/ui/html` and give its
   public props an Effect schema.
3. Export `astroComponent(Component)` from a TypeScript module using
   `@opsydyn/astro-effect-ui/component`.
4. Import that module from an Astro page and pass its props normally.

| Behaviour | Astro usage |
| --- | --- |
| Read-only markup | Render with no client directive |
| Interactive immediately | `client:load` |
| Deferred until visible | `client:visible` |
| Deferred until a reader interacts | `client:interaction` |
| Requires a browser to initialize | `client:only="astro-effect-ui"` |

See [integration and migration details](references/integration.md). The
[counter fixture](assets/counter/) uses the private `1.0.0-next.0` renderer.
Install the local standalone renderer archive when rehearsing that version.

Verify the built page with JavaScript disabled and enabled. For an Astro
navigation flow, check that retained islands keep their state and replaced
islands close their scopes.
