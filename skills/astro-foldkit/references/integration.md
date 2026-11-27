# Astro Effect UI integration

## Configure Astro

```ts
import { defineConfig } from 'astro/config';
import effectUi from '@opsydyn/astro-effect-ui';

export default defineConfig({ integrations: [effectUi()] });
```

Keep request authorization and metadata in Astro's frontmatter and layouts. Pass
only serializable public props into the component. The renderer serializes the
state it needs to adopt server markup, so values in that state are browser-visible.

On a page that renders markup during build or on request, make the component's
initial render safe without browser APIs. Use a scoped mount or command to start
work that needs the browser. Use `client:only="astro-effect-ui"` when there is no
useful server rendering path.

Use `client:interaction` for a component that can wait for the first keyboard
or pointer interaction. The integration replays that interaction after adoption.
Use `client:load` when the widget drives the page or starts a live subscription.

## Migrate existing imports

- Replace `lazyApp` and `defineApp` with an Effect UI HTML component wrapped in
  `astroComponent` from `@opsydyn/astro-effect-ui/component`.
- Move `definePage`, request-derived Flags and `resolvePageDocument` to the
  Astro route. Resolve the page title, authorization and props before rendering.
- Use Astro navigation and the island's scope for activation and cleanup.
- Compose shared content in Astro or the component tree. The renderer currently
  accepts no Astro slots.

For existing FoldKit 0.x applications, pin the last compatible Astro integration
and migrate the application before adopting the new package.
