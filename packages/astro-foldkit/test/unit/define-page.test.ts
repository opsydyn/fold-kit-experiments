import { describe, expect, it } from 'bun:test';

import type { Document, HtmlBuilder } from 'foldkit/html';

import { definePage } from '../../src/define-page';
import { check } from '../../src/server';
import type { AppConfig } from '../../src/types';

describe('definePage', () => {
  it('marks pages distinctly and keeps them inert for the current server renderer', async () => {
    type Flags = { readonly locale: string };
    type Model = { readonly locale: string };
    type Message = { readonly _tag: 'NoOp' };

    const config = {
      Model: {} as AppConfig<Flags, Model, Message>['Model'],
      init: (flags: Flags) => [{ locale: flags.locale }, []] as const,
      update: (model: Model, _message: Message) => [model, []] as const,
      view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
    } satisfies AppConfig<Flags, Model, Message>;

    const page = definePage(() => Promise.resolve(config), {
      flags: ({ props }: { readonly props: { readonly locale: string } }) => ({
        locale: props.locale,
      }),
    });

    expect(page.__foldkitPage).toBe(true);
    expect('__foldkit' in page).toBe(false);
    expect(await check(page)).toBe(false);
  });
});
