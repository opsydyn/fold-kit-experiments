/**
 * collectHtml — walk a foldkit Html tree and extract text + attribute values.
 *
 * Works against the virtual DOM node structure returned by foldkit's
 * `html<M>()` builder without requiring a real DOM.
 *
 * Usage:
 *   const tree = BarChart.view({ model, toParentMessage: identity, ariaLabel: 'test' });
 *   const text  = collectText(tree);        // all text nodes joined
 *   const roles = collectAttr(tree, 'role'); // all role="" values
 *   const labels = collectAttr(tree, 'aria-label'); // all aria-label values
 */

/** Internal — recursive walk over the VNode tree */
function walk(node: unknown, visit: (n: unknown) => void): void {
  visit(node);
  // foldkit vdom: { tag, attributes, children } or { _tag: 'Text', value: string }
  if (node && typeof node === 'object') {
    const children = (node as Record<string, unknown>)['children'];
    if (Array.isArray(children)) {
      for (const child of children) walk(child, visit);
    }
  }
}

/**
 * Collect all text content from the Html tree (leaf text nodes).
 */
export function collectText(root: unknown): string {
  const parts: string[] = [];
  walk(root, (node) => {
    if (typeof node === 'string') {
      parts.push(node);
    } else if (node && typeof node === 'object') {
      const v = (node as Record<string, unknown>)['value'];
      if ((node as Record<string, unknown>)['_tag'] === 'Text' && typeof v === 'string') {
        parts.push(v);
      }
    }
  });
  return parts.join('');
}

/**
 * Collect all values of a specific attribute from any element in the tree.
 */
export function collectAttr(root: unknown, attrName: string): ReadonlyArray<string> {
  const found: string[] = [];
  walk(root, (node) => {
    if (!node || typeof node !== 'object') return;
    const attrs = (node as Record<string, unknown>)['attributes'];
    if (!Array.isArray(attrs)) return;
    for (const attr of attrs) {
      if (!attr || typeof attr !== 'object') continue;
      const a = attr as Record<string, unknown>;
      // foldkit attribute: { _tag: 'AttributeName', value: 'val' }
      // or { _tag: 'AriaLabel', value: '...' } etc.
      const tag = a['_tag'];
      const val = a['value'];
      if (typeof val !== 'string') continue;
      // Match by _tag (e.g. 'Role' for role=, 'AriaLabel' for aria-label=)
      // or by attribute name for h.Attribute('name', val) calls
      const normalised = typeof tag === 'string'
        ? tag.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()
        : '';
      if (
        normalised === attrName ||
        normalised === attrName.replace(/^aria-/, 'aria') ||
        (a['name'] === attrName) // h.Attribute('name', 'value') pattern
      ) {
        found.push(val);
      }
    }
  });
  return found;
}

/**
 * Count the number of SVG elements with a given tag name in the tree.
 */
export function countElements(root: unknown, tagName: string): number {
  let count = 0;
  walk(root, (node) => {
    if (node && typeof node === 'object') {
      const tag = (node as Record<string, unknown>)['tag'];
      if (tag === tagName) count++;
    }
  });
  return count;
}

/**
 * Find all nodes matching a predicate.
 */
export function findNodes(
  root: unknown,
  predicate: (node: unknown) => boolean,
): ReadonlyArray<unknown> {
  const found: unknown[] = [];
  walk(root, (node) => { if (predicate(node)) found.push(node); });
  return found;
}
