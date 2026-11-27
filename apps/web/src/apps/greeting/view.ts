import type { Html } from '@effect/ui/html';

import { Message } from './message';
import type { Locale, Model } from './model';
import { presentationFor } from './presentation';

import * as styles from './greeting.css';

export const view = (h: Html.H<Message>, model: Model) => {
  const { greeting } = presentationFor(model);
  const localeButton = (locale: Locale, label: string) => {
    const selected = model.locale === locale;
    return h.button
      .class(
        selected ? `${styles.localeButton} ${styles.localeButtonSelected}` : styles.localeButton,
      )
      .attrs({ type: 'button', 'aria-pressed': String(selected) })
      .on('click', Message.SelectedLocale({ locale }))
      .children(label);
  };
  return h.div
    .class(styles.card)
    .children(
      h.p.class(styles.greeting).children(greeting),
      h.div
        .class(styles.localeGroup)
        .attrs({ role: 'group', 'aria-label': 'Greeting language' })
        .children(localeButton('en', 'English'), localeButton('ar', 'Arabic')),
      h.button
        .class(styles.resetButton)
        .attr('type', 'button')
        .on('click', Message.Reset())
        .children('Reset'),
    );
};
