# Astro package migration

`@opsydyn/astro-foldkit` 1.x forwards the integration and component adapter
from `@opsydyn/astro-effect-ui`. Both import paths use the same renderer.
This branch uses the `1.0.0-next.0` archives for local qualification.

```ts
import { defineConfig } from 'astro/config';
import effectUi from '@opsydyn/astro-effect-ui';

export default defineConfig({ integrations: [effectUi()] });
```

Define a component with Effect UI's `Html.component(...)`, then expose it
to Astro from a normal TypeScript module.

```ts
import { astroComponent } from '@opsydyn/astro-effect-ui/component';
import { Counter } from './counter';

export default astroComponent(Counter);
```

Use the component as a normal Astro import. Astro renders its markup on
the server. Choose `client:load`, `client:idle`, `client:visible` or
`client:interaction` when it needs a browser runtime. For browser-only
components use `client:only="astro-effect-ui"`.

| 0.x import or option                                         | 1.x migration                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Default integration from `@opsydyn/astro-foldkit`            | Use the default integration from `@opsydyn/astro-effect-ui`. The previous package name also forwards to it.        |
| `/define-app`, `lazyApp`, `defineApp`, or `prerender` option | Move the model, messages and view to `Html.component` and wrap it with `astroComponent` from `/component`.         |
| `/define-page`, Flags, or the `/server` document resolver    | Resolve request data, page metadata and layouts in Astro. Pass only public, serializable props into the component. |
| Build IDs and navigation messages                            | Use Astro's navigation and the Effect UI island scope.                                                             |
| Slots into an island                                         | Compose the markup in an Astro layout or inside the component tree.                                                |

Consumers still running FoldKit can pin the published 0.x integration.
The standalone renderer's release artifact is staged in
`packages/astro-effect-ui/dist`. Rehearse both archives together because
the forwarding archive declares the exact standalone version.
