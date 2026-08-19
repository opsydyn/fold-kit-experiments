import type { DefinePageOptions, FoldkitPage, PageConfigShape } from './types';

export type {
  DefinePageOptions,
  PageConfig,
  PageFlagsContext,
  PageFlagsSchema,
  FoldkitPage,
  PageConfigShape,
  PageContext,
  PageParams,
} from './types';

export function definePage<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Flags extends Record<string, unknown> = Record<string, unknown>,
  Config extends PageConfigShape<Flags> = PageConfigShape<Flags>,
>(
  load: () => Promise<Config>,
  options: DefinePageOptions<Props, Flags>,
): FoldkitPage<Props, Flags, Config> {
  return Object.assign((_props?: Props) => {}, {
    __foldkitPage: true as const,
    load,
    flags: options.flags,
  });
}
