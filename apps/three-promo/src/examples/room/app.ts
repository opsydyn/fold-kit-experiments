import { astroComponent } from '@opsydyn/astro-effect-ui/component';
import { attachSceneDevTools } from '@opsydyn/effect-three-samples/devtools';
import Room from '@opsydyn/effect-three-samples/room';

import '@opsydyn/effect-three-samples/styles.css';

if (
  import.meta.env.DEV &&
  !import.meta.env.SSR &&
  import.meta.env.PUBLIC_EFFECT_UI_DEVTOOLS === '1'
) {
  attachSceneDevTools();
}

export default astroComponent(Room);
