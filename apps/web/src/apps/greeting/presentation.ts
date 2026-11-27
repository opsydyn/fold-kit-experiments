import type { Locale, Model } from './model';

export const localeFromUrl = (url: URL): Locale =>
  url.searchParams.get('locale') === 'ar' ? 'ar' : 'en';

const canonicalByLocale = {
  en: 'https://opsydyn-web.opsydyn.workers.dev/greeting',
  ar: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
} satisfies Readonly<Record<Locale, string>>;

type GreetingPresentation = Readonly<{
  title: string;
  greeting: string;
  lang: 'ar' | 'en';
  dir: 'rtl' | 'ltr';
  canonical: string;
  ogUrl: string;
}>;

export const presentationFor = (model: Model): GreetingPresentation => {
  const presentation =
    model.locale === 'ar'
      ? {
          title: `مرحبا، ${model.name}! — Astro + Effect UI`,
          greeting: `مرحبا، ${model.name}!`,
          lang: 'ar' as const,
          dir: 'rtl' as const,
        }
      : {
          title: `Hello, ${model.name}! — Astro + Effect UI`,
          greeting: `Hello, ${model.name}!`,
          lang: 'en' as const,
          dir: 'ltr' as const,
        };
  const canonical = canonicalByLocale[model.locale];
  return { ...presentation, canonical, ogUrl: canonical };
};
