import type { NamedSSRLoadedRendererValue } from 'astro';

export async function check(Component: unknown): Promise<boolean> {
  return (
    Component != null &&
    (typeof Component === 'object' || typeof Component === 'function') &&
    '__foldkit' in (Component as object) &&
    (Component as { __foldkit: unknown }).__foldkit === true
  );
}

export async function renderToStaticMarkup(
  _component: unknown,
  _props: Record<string, unknown>,
  _slots: Record<string, string>,
): Promise<{ html: string }> {
  return { html: '<div data-foldkit-island="true"></div>' };
}

const renderer: NamedSSRLoadedRendererValue = {
  name: 'astro-foldkit',
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
};

export default renderer;
