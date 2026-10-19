# @opsydyn/effect-three-troika

Troika distance-field text for `@opsydyn/effect-three`. Labels are described as data;
this package is the engine that draws them, as Drei's `Text` does with
[troika-three-text](https://protectwise.github.io/troika/troika-three-text/).

```sh
npm install @opsydyn/effect-three-troika @opsydyn/effect-three three
```

Released with the core at one version: see its [Stability](../effect-three/README.md#stability)
and [Limits](../effect-three/README.md#limits).

```ts
import { label, scene } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { troikaLabels } from '@opsydyn/effect-three-troika';

const environment = EffectThreeFoldkit.makeEnvironment(window, { labels: troikaLabels() });

scene({
  children: [
    label({
      key: 'title',
      text: 'Hello',
      font: '/fonts/inter-latin-400-normal.woff',
      fontSize: 0.5,
      maxWidth: 4,
      outlineWidth: 0.02,
    }),
  ],
});
```

For three's `WebGPURenderer` (`webgpuRendererFactory`), take `troikaLabels` from
`@opsydyn/effect-three-troika/webgpu` instead. It draws with either renderer: troika still
lays the text out and builds its glyphs, and under WebGPU a node material (TSL) draws
them, outlines, curves, colour ranges and lit materials included. It is a separate entry
so that WebGL-only pages do not bundle three's WebGPU build.

```ts
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';

const environment = EffectThreeFoldkit.makeEnvironment(window, {
  renderer: EffectThreeFoldkit.webgpuRendererFactory,
  labels: troikaLabels(),
});
```

Fonts load and glyphs build in a worker; the scene draws again when they are ready. Give
each label a font URL (TTF, OTF or WOFF: troika 0.52 cannot read WOFF2 in its worker).
Without one troika fetches its default font from a CDN.

troika-three-text is MIT.
