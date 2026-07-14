export type NavigationPhase = 'coldLoad' | 'entered' | 'exited' | 'stayed';

export type NavigationEvent = {
  readonly phase: NavigationPhase;
  readonly path: string;
  readonly previousPath: string | null;
};

export type NavigationConfig<Value> = {
  readonly port: string;
  readonly map: (event: NavigationEvent) => Value;
};

export const normalizeNavigationEvent = (
  phase: NavigationPhase,
  currentUrl: string,
  previousUrl: string | null,
): NavigationEvent => ({
  phase,
  path: new URL(currentUrl, 'https://astro-foldkit.invalid').pathname,
  previousPath:
    previousUrl === null ? null : new URL(previousUrl, 'https://astro-foldkit.invalid').pathname,
});
