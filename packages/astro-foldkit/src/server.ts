import type { NamedSSRLoadedRendererValue } from 'astro'

export async function check(Component: unknown): Promise<boolean> {
  return (
    Component != null &&
    (typeof Component === 'object' || typeof Component === 'function') &&
    '__foldkit' in (Component as object) &&
    (Component as { __foldkit: unknown }).__foldkit === true
  )
}

async function renderToStaticMarkup(): Promise<{ html: string }> {
  return { html: '' }
}

const renderer: NamedSSRLoadedRendererValue = {
  name: 'astro-foldkit',
  check,
  renderToStaticMarkup,
  supportsAstroStaticSlot: true,
}

export default renderer
