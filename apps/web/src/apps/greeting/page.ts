import { definePage } from '@opsydyn/astro-foldkit/define-page';
import { Match, Schema } from 'effect';

import * as main from './main';
import { Flags, type Locale, type Name } from './model';

type Props = {
  readonly name: Name;
};

const localeFromUrl = (url: URL): Locale =>
  Match.value(url.searchParams.get('locale')).pipe(
    Match.when('ar', () => 'ar' as const),
    Match.when('en', () => 'en' as const),
    Match.orElse(() => 'en' as const),
  );

export default definePage<Props, Flags>(() => Promise.resolve(main), {
  flags: ({ props, url }) =>
    Schema.decodeSync(Flags)({
      name: props.name,
      locale: localeFromUrl(url),
    }),
});
