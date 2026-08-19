import { describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { readFoldkitBuildId } from '../../src/build-id';
import { renderFoldkitServerApplication } from '../../src/server-render';
import type { PageConfig } from '../../src/types';

type Flags = {
  readonly name: string;
};

type Model = {
  readonly name: string;
};

type Message = {
  readonly _tag: 'NoOp';
};

const Flags = Schema.Struct({ name: Schema.String });

const config = {
  Flags,
  Model: {},
  init: (flags: Flags) => [{ name: flags.name }, [{ _tag: 'NotRun' }]] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
  view: (model: Model, h: HtmlBuilder<Message>): Document => ({
    title: `Hello ${model.name}`,
    body: h.main([], [`Hello ${model.name}`]),
  }),
} satisfies PageConfig<Flags, Model, Message>;

describe('readFoldkitBuildId', () => {
  it('reads the Vite-injected FoldKit build identity', () => {
    expect(readFoldkitBuildId({ FOLDKIT_BUILD_ID: 'test-build' })).toBe('test-build');
  });

  it('rejects absent and empty FoldKit build identities', () => {
    expect(() => readFoldkitBuildId({})).toThrow('FOLDKIT_BUILD_ID');
    expect(() => readFoldkitBuildId({ FOLDKIT_BUILD_ID: '' })).toThrow('FOLDKIT_BUILD_ID');
  });
});

describe('renderFoldkitServerApplication', () => {
  it('hands Flags, init, view, and build identity to FoldKit server rendering', async () => {
    const rendered = await renderFoldkitServerApplication(config, { name: 'Ada' }, 'build-123');

    expect(rendered.title).toBe('Hello Ada');
    expect(rendered.html).toContain('Hello Ada');
    expect(rendered.html).toContain('data-foldkit-app="app"');
    expect(rendered.html).toContain('data-foldkit-build="build-123"');
  });

  it('rejects invalid Flags before emitting HTML', async () => {
    await expect(
      renderFoldkitServerApplication(config, { name: 42 } as unknown as Flags, 'build-123'),
    ).rejects.toMatchObject({ _tag: 'FlagsEncodeError' });
  });

  it('fails closed when the build identity is missing', async () => {
    await expect(renderFoldkitServerApplication(config, { name: 'Ada' }, '')).rejects.toMatchObject(
      { _tag: 'MissingBuildId' },
    );
  });
});
