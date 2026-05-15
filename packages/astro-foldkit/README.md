# @opsydyn/astro-foldkit

Astro integration and renderer for [FoldKit](https://foldkit.dev).

FoldKit is an Elm Architecture runtime built on [Effect](https://effect.website). This package registers FoldKit as an Astro renderer so you can drop any FoldKit app into a `.astro` page as a component and hydrate it with `client:load`.

## Installation

```sh
npm install @opsydyn/astro-foldkit
# peer deps
npm install astro foldkit
```

## Setup

Add the integration to `astro.config.ts`:

```ts
import { defineConfig } from 'astro/config'
import foldkit from '@opsydyn/astro-foldkit'

export default defineConfig({
  integrations: [foldkit()],
})
```

## Defining an app

Use `defineApp` to register a FoldKit app for lazy loading. The loader returns your `main.ts` module which must export a value that satisfies `AppConfig`.

```ts
// src/apps/counter/app.ts
import { defineApp } from '@opsydyn/astro-foldkit/define-app'

export default defineApp(() => import('./main'))
```

```ts
// src/apps/counter/main.ts
import type { AppConfig } from '@opsydyn/astro-foldkit/define-app'

export const Model = null
export const init = () => [0, []] as const
export const update = (model: number, message: 'Inc' | 'Dec') =>
  [message === 'Inc' ? model + 1 : model - 1, []] as const
export const view = (model: number) => ({ /* foldkit view tree */ })

// AppConfig is satisfied by the module's named exports
```

Use the app in an Astro page:

```astro
---
import Counter from '../apps/counter/app'
---
<Counter client:load />
```

## AppConfig

The module returned by your loader must export:

| Export   | Type                                                        | Description                                      |
| :------- | :---------------------------------------------------------- | :----------------------------------------------- |
| `Model`  | `unknown`                                                   | Initial model type marker                        |
| `init`   | `(...args) => readonly [Model, ReadonlyArray<Command>]`     | Initial state and startup commands               |
| `update` | `(model, message) => readonly [Model, ReadonlyArray<Command>]` | Pure state transition                         |
| `view`   | `(model) => Document`                                       | Render the current model to a FoldKit view tree  |

## Exports

| Entry point                          | Description                              |
| :----------------------------------- | :--------------------------------------- |
| `@opsydyn/astro-foldkit`             | Default Astro integration (`foldkit()`)  |
| `@opsydyn/astro-foldkit/define-app`  | `defineApp` helper and `AppConfig` type  |

## Peer dependencies

| Package  | Version  |
| :------- | :------- |
| `astro`  | `≥ 5.0`  |
| `foldkit`| `≥ 0.96` |

## License

MIT
