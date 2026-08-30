import type { Document, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import type { Locale, Model } from './model';

import * as styles from './greeting.css';

const canonicalByLocale: Readonly<Record<Locale, string>> = {
  en: 'https://opsydyn-web.opsydyn.workers.dev/greeting',
  ar: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const { div, p, button, Class, OnClick, AriaLabel, AriaPressed, Role } = h;
  const presentation =
    model.locale === 'ar'
      ? {
          title: `مرحبا، ${model.name}! — Astro + FoldKit`,
          greeting: `مرحبا، ${model.name}!`,
          lang: 'ar',
          dir: 'Rtl' as const,
        }
      : {
          title: `Hello, ${model.name}! — Astro + FoldKit`,
          greeting: `Hello, ${model.name}!`,
          lang: 'en',
          dir: 'Ltr' as const,
        };
  const canonical = canonicalByLocale[model.locale];
  const localeButton = (locale: Locale, label: string) => {
    const selected = model.locale === locale;
    return button(
      [
        Class(
          selected ? `${styles.localeButton} ${styles.localeButtonSelected}` : styles.localeButton,
        ),
        AriaPressed(selected ? 'true' : 'false'),
        OnClick(Message.SelectedLocale({ locale })),
      ],
      [label],
    );
  };

  return {
    title: presentation.title,
    lang: presentation.lang,
    dir: presentation.dir,
    canonical,
    ogUrl: canonical,
    body: div(
      [Class(styles.card)],
      [
        p([Class(styles.greeting)], [presentation.greeting]),
        div(
          [Class(styles.localeGroup), Role('group'), AriaLabel('Greeting language')],
          [localeButton('en', 'English'), localeButton('ar', 'Arabic')],
        ),
        button([Class(styles.resetButton), OnClick(Message.Reset())], ['Reset']),
      ],
    ),
  };
};
