import type { Html } from '@effect/ui/html';

import { Message } from './message';
import type { Loaded, Model } from './model';
import { CarouselInput } from './mount';

import * as styles from './carousel.css';

function transform({ drag, activeIndex }: Loaded): string {
  if (drag._tag === 'Idle') return `translateX(-${activeIndex * 100}%)`;
  if (drag._tag === 'Dragging') {
    return `translateX(calc(-${drag.originIndex * 100}% + ${drag.deltaX}px))`;
  }
  const { fromIndex, targetIndex, fromDeltaX, elapsed, duration } = drag;
  const progress = 1 - (1 - Math.min(elapsed / Math.max(duration, 1), 1)) ** 3;
  const index = fromIndex + (targetIndex - fromIndex) * progress;
  return `translateX(calc(-${index * 100}% + ${fromDeltaX * (1 - progress)}px))`;
}

export function view(h: Html.H<Message>, model: Model) {
  if (model._tag === 'Loading') {
    return h.div.class(styles.root).attr('role', 'status').children('Loading slides…');
  }
  const { activeIndex, slides } = model;
  const dragging = model.drag._tag === 'Dragging';
  const arrow = (label: string, text: string, click: Message) =>
    h.button
      .class(styles.arrowButton)
      .attr('type', 'button')
      .attr('aria-label', label)
      .on('click', click)
      .children(text);

  return h.div
    .class(styles.root)
    .attr('role', 'region')
    .attr('aria-label', 'Feature carousel')
    .attr('data-carousel-id', 'main')
    .attr('tabindex', '0')
    .onMount(CarouselInput())
    .children(
      h.div
        .class(styles.track)
        .attr('data-carousel-track-id', 'main')
        .style({ touchAction: 'pan-y' })
        .children(
          h.div
            .class(styles.slideContainer)
            .style({
              transform: transform(model),
              willChange: 'transform',
              cursor: dragging ? 'grabbing' : 'grab',
            })
            .children(
              ...slides.map(({ title, caption, bg }, index) =>
                h.div
                  .key(String(index))
                  .class(styles.slide)
                  .attr('data-carousel-slide', String(index))
                  .attr('role', 'group')
                  .attr('aria-roledescription', 'slide')
                  .attr('aria-label', `${index + 1} of ${slides.length}`)
                  .attr('aria-hidden', index === activeIndex ? undefined : 'true')
                  .style({ background: bg })
                  .children(
                    h.div.class(styles.slideNumber).children(String(index + 1).padStart(2, '0')),
                    h.div.class(styles.slideTitle).children(title),
                    h.div.class(styles.slideCaption).children(caption),
                  ),
              ),
            ),
        ),
      h.div.class(styles.controls).children(
        h.div
          .class(styles.arrows)
          .children(
            arrow('Previous slide', '←', Message.ClickedPrevious()),
            arrow('Next slide', '→', Message.ClickedNext()),
          ),
        h.div.class(styles.dots).children(
          ...slides.map((_, index) =>
            h.button
              .key(String(index))
              .class(styles.dot)
              .attr('type', 'button')
              .attr('aria-label', `Go to slide ${index + 1}`)
              .attr('aria-pressed', String(index === activeIndex))
              .attr('data-active', index === activeIndex ? '' : undefined)
              .on('click', Message.ClickedDot({ index })),
          ),
        ),
      ),
    );
}
