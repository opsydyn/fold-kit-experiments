import { Option } from 'effect';
import { Scene } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import { describe, expect, test } from 'vitest';

import * as Carousel from './index';

const model = Carousel.init({
  id: 'test-carousel',
  slideCount: 3,
  initialIndex: 1,
  loop: false,
}).model;

const view = (nextModel: Carousel.Model, h: HtmlBuilder<Carousel.Message>) =>
  Carousel.view(
    {
      model: nextModel,
      toParentMessage: (message) => message,
      toView: ({ root, slide }) => h.div(root, [h.div(slide(0), [])]),
    },
    h,
  );

const update = (nextModel: Carousel.Model, _message: Carousel.Message) => ({
  model: nextModel,
});

describe('carousel keyboard handling', () => {
  test('does not consume a key event that originates in a carousel descendant', () => {
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.tap(({ html }) => {
        const root = Option.getOrThrow(Scene.find(html, '[data-carousel-id="test-carousel"]'));
        const slide = Option.getOrThrow(Scene.find(html, '[data-carousel-slide="0"]'));
        const keydown = Option.getOrThrow(
          Option.fromNullishOr([root.data?.on?.keydown ?? []].flat()[0]),
        );
        const event = new KeyboardEvent('keydown', {
          cancelable: true,
          key: 'ArrowRight',
        });

        Object.defineProperty(event, 'target', { value: slide });
        Object.defineProperty(event, 'currentTarget', { value: root });
        keydown.call(root, event, root);

        expect(event.defaultPrevented).toBe(false);
      }),
    );
  });
});
