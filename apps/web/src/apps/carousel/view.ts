import { AsyncData } from 'foldkit/asyncData';
import type { Document, Node } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as Carousel from '../../ui/carousel';
import type { Message } from './message';
import { GotCarouselMessage } from './message';
import type { Model, Slide } from './model';

import * as styles from './carousel.css';

type CarouselMessage = Carousel.Message;

const { div, button, Class, Style } = html<Message>();

const pad = (n: number): string => String(n).padStart(2, '0');

const toParentMessage = (msg: CarouselMessage): Message => GotCarouselMessage({ message: msg });

const slideCount = (model: Model): number => model.carousel.slideCount;

const slidesView = (slides: ReadonlyArray<Slide>, model: Model): Node =>
  Carousel.view({
    model: model.carousel,
    toParentMessage,
    ariaLabel: 'Feature carousel',
    toView: ({ root, track, slideContainer, slide, prevButton, nextButton, dot }) =>
      div(
        [Class(styles.root), ...root],
        [
          div(
            [Class(styles.track), ...track],
            [
              div(
                [Class(styles.slideContainer), ...slideContainer],
                slides.map(({ title, caption, bg }, index) =>
                  div(
                    [Class(styles.slide), Style({ background: bg }), ...slide(index)],
                    [
                      div([Class(styles.slideNumber)], [pad(index + 1)]),
                      div([Class(styles.slideTitle)], [title]),
                      div([Class(styles.slideCaption)], [caption]),
                    ],
                  ),
                ),
              ),
            ],
          ),
          div(
            [Class(styles.controls)],
            [
              div(
                [Class(styles.arrows)],
                [
                  button([Class(styles.arrowButton), ...prevButton], ['←']),
                  button([Class(styles.arrowButton), ...nextButton], ['→']),
                ],
              ),
              div(
                [Class(styles.dots)],
                Array.from({ length: slideCount(model) }, (_, index) =>
                  button([Class(styles.dot), ...dot(index)], []),
                ),
              ),
            ],
          ),
        ],
      ),
  });

export const view = (model: Model): Document => ({
  title: `Carousel — slide ${model.carousel.activeIndex + 1} of ${slideCount(model)}`,
  body: AsyncData.matchData(model.slides, {
    onEmpty: () => div([Class(styles.root)], [div([], ['Loading slides…'])]),
    onFailure: (error) => div([Class(styles.root)], [div([], [`Failed to load slides: ${error}`])]),
    onData: (slides) => slidesView(slides, model),
  }),
});
