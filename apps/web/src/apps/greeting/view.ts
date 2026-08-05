import type { Document, HtmlBuilder } from 'foldkit/html';

import type { Message } from './message';
import { Reset, SelectedLocale } from './message';
import type { Locale, Model } from './model';

import * as styles from './greeting.css';

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const { div, p, button, Class, OnClick, AriaLabel, AriaPressed, Role } = h;
  const presentation =
    model.locale === 'ar'
      ? {
          title: 'مرحبا!',
          greeting: `مرحبا، ${model.name}!`,
          lang: 'ar',
          dir: 'Rtl' as const,
        }
      : {
          title: `Hello, ${model.name}!`,
          greeting: `Hello, ${model.name}!`,
          lang: 'en',
          dir: 'Ltr' as const,
        };
  const localeButton = (locale: Locale, label: string) => {
    const selected = model.locale === locale;
    return button(
      [
        Class(
          selected ? `${styles.localeButton} ${styles.localeButtonSelected}` : styles.localeButton,
        ),
        AriaPressed(selected ? 'true' : 'false'),
        OnClick(SelectedLocale({ locale })),
      ],
      [label],
    );
  };

  return {
    title: presentation.title,
    lang: presentation.lang,
    dir: presentation.dir,
    body: div(
      [Class(styles.card)],
      [
        p([Class(styles.greeting)], [presentation.greeting]),
        div(
          [Class(styles.localeGroup), Role('group'), AriaLabel('Greeting language')],
          [localeButton('en', 'English'), localeButton('ar', 'Arabic')],
        ),
        button([Class(styles.resetButton), OnClick(Reset())], ['Reset']),
      ],
    ),
  };
};
