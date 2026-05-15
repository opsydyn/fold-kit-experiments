import { Runtime } from 'foldkit'

import type { FoldkitApp } from './types'

export default (element: HTMLElement) =>
  async (
    component: FoldkitApp,
    _props: Record<string, unknown>,
    _slots: Record<string, unknown>,
    _meta: { client: string },
  ): Promise<void> => {
    const config = await component.load()

    element.id ||= element.getAttribute('uid') ?? crypto.randomUUID()

    const program = Runtime.makeProgram({
      ...(config as any),
      container: element,
    })

    Runtime.run(program)

    element.addEventListener('astro:unmount', () => {}, { once: true })
  }
