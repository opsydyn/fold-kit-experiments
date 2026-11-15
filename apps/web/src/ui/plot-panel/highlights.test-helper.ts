/**
 * The dots a linked highlight keeps bright: when some dots are dimmed, the
 * ones at full opacity; when none are, there is no highlight and so none.
 */
export function linkedDots(node: ParentNode): ReadonlyArray<Element> {
  const dots = [...node.querySelectorAll('.plot-mark.plot-dot circle')];
  const opacity = (dot: Element) => Number(dot.getAttribute('opacity') ?? 1);
  return dots.some((dot) => opacity(dot) < 1) ? dots.filter((dot) => opacity(dot) === 1) : [];
}
