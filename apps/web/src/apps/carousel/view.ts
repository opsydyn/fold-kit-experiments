import type { Document } from 'foldkit/html';
import { html } from 'foldkit/html';

import * as Carousel from '../../ui/carousel';
import * as styles from './carousel.css';
import type { Message } from './message';
import { GotCarouselMessage } from './message';
import type { Model } from './model';
import { SLIDE_COUNT } from './model';

type CarouselMessage = Carousel.Message;

const SLIDES: ReadonlyArray<{ title: string; caption: string; bg: string }> = [
  {
    title: 'Adventure',
    caption: 'Into the unknown',
    bg: 'linear-gradient(135deg,#dbeafe,#93c5fd)',
  },
  {
    title: 'Discovery',
    caption: 'Find what matters',
    bg: 'linear-gradient(135deg,#fce7f3,#f9a8d4)',
  },
  { title: 'Journey', caption: 'Every step counts', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
  { title: 'Wonder', caption: 'Stay curious', bg: 'linear-gradient(135deg,#d1fae5,#6ee7b7)' },
  { title: 'Dream', caption: 'Make it real', bg: 'linear-gradient(135deg,#ede9fe,#c4b5fd)' },
];

const { div, button, Class, Style } = html<Message>();

const pad = (n: number): string => String(n).padStart(2, '0');

const toParentMessage = (msg: CarouselMessage): Message => GotCarouselMessage({ message: msg });

export const view = (model: Model): Document => ({
  title: `Carousel — slide ${model.carousel.activeIndex + 1} of ${SLIDE_COUNT}`,
  body: Carousel.view({
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
                SLIDES.map(({ title, caption, bg }, index) =>
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
                Array.from({ length: SLIDE_COUNT }, (_, index) =>
                  button([Class(styles.dot), ...dot(index)], []),
                ),
              ),
            ],
          ),
        ],
      ),
  }),
});
