import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import { init } from './model';
import { update } from './update';
import { view } from './view';

const initialModel = init({ name: 'astronaut' })[0];

describe('greeting scene', () => {
  test('switches the rendered greeting to Arabic', () => {
    Scene.scene(
      { update, view },
      Scene.given(initialModel),
      Scene.expect(Scene.role('button', { name: 'English' })).toHaveAttr('aria-pressed', 'true'),
      Scene.click(Scene.role('button', { name: 'Arabic' })),
      Scene.expect(Scene.role('button', { name: 'Arabic' })).toHaveAttr('aria-pressed', 'true'),
      Scene.expect(Scene.text('مرحبا، astronaut!')).toExist(),
    );
  });
});
