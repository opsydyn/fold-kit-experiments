import type { DefinePageOptions, EmptyProps, FoldkitPage, PageConfigContract } from './types';

export type {
  DefinePageOptions,
  PageConfig,
  PageFlagsContext,
  PageFlagsSchema,
  FoldkitPage,
  PageConfigContract,
  PageContext,
  PageParams,
} from './types';

export function definePage<
  Props extends object = EmptyProps,
  Flags extends object = EmptyProps,
  Config extends PageConfigContract<Flags> = PageConfigContract<Flags>,
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
