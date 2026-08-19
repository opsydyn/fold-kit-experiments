import { describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { definePage } from '../../src/define-page';
import type { PageConfig, PageFlagsContext } from '../../src/define-page';
import { check } from '../../src/server';
import type { AppConfig } from '../../src/types';

describe('definePage', () => {
  it('marks pages distinctly for the server renderer', async () => {
    type Flags = { readonly locale: string };
    type Model = { readonly locale: string };
    type Message = { readonly _tag: 'NoOp' };
    type Props = { readonly locale: string };

    const Flags = Schema.Struct({ locale: Schema.String });

    const config = {
      Flags,
      Model: {} as AppConfig<Flags, Model, Message>['Model'],
      init: (flags: Flags) => [{ locale: flags.locale }, []] as const,
      update: (model: Model, _message: Message) => [model, []] as const,
      view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
    } satisfies PageConfig<Flags, Model, Message>;

    const missingFlagsConfig = {
      Model: {} as AppConfig<Flags, Model, Message>['Model'],
      init: (flags: Flags) => [{ locale: flags.locale }, []] as const,
      update: (model: Model, _message: Message) => [model, []] as const,
      view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
    };
    // @ts-expect-error Page configs must declare the FoldKit Flags codec.
    void (missingFlagsConfig satisfies PageConfig<Flags, Model, Message>);

    const page = definePage(() => Promise.resolve(config), {
      flags: ({ props }: PageFlagsContext<Props>) => ({
        locale: props.locale,
      }),
    });

    const context: PageFlagsContext<Props> = {
      request: new Request('https://example.com/en'),
      url: new URL('https://example.com/en'),
      params: { locale: 'en' },
      props: { locale: 'en' },
    };

    expect(page.__foldkitPage).toBe(true);
    expect('__foldkit' in page).toBe(false);
    expect(page.flags(context)).toEqual({ locale: 'en' });
    expect(await check(page)).toBe(true);
    expect((await page.load()).Flags).toBe(Flags);
  });
});
