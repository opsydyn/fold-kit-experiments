/** Resolve every local page/download against Astro's configured deployment directory. */
export const sitePath = (path: string): string =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
