# @opsydyn/effect-three-troika

Troika distance-field text for `@opsydyn/effect-three`. Labels are described as data;
this package is the engine that draws them, as Drei's `Text` does with
[troika-three-text](https://protectwise.github.io/troika/troika-three-text/).

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

Fonts load and glyphs build in a worker; the scene draws again when they are ready. Give
each label a font URL (TTF, OTF or WOFF: troika 0.52 cannot read WOFF2 in its worker).
Without one troika fetches its default font from a CDN.

troika-three-text is MIT.
