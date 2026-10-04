/**
 * collectHtml - walk a foldkit Html tree and extract text + attribute values.
 *
 * The probe contract mirrors the small vnode surface used by these tests. It
 * keeps the untyped renderer boundary in one place while giving every walker
 * operation a concrete node type.
 */

export type HtmlProbeText = {
  readonly _tag: 'Text';
  readonly value: string;
};

export type HtmlProbeAttribute = {
  readonly _tag?: string;
  readonly name?: string;
  readonly value?: string;
};

export type HtmlProbeElement = {
  readonly tag?: string;
  readonly attributes?: ReadonlyArray<HtmlProbeAttribute>;
  readonly children?: ReadonlyArray<HtmlProbeNode>;
};

export type HtmlProbeNode = string | HtmlProbeText | HtmlProbeElement;

const isTextNode = (node: HtmlProbeNode): node is string => typeof node === 'string';

export const isElementNode = (node: HtmlProbeNode): node is HtmlProbeElement =>
  !isTextNode(node) && !('_tag' in node);

/** Internal - recursively visit the vnode tree. */
function walk(node: HtmlProbeNode, visit: (node: HtmlProbeNode) => void): void {
  visit(node);
  if (!isElementNode(node) || node.children === undefined) return;
  for (const child of node.children) walk(child, visit);
}

/** Collect all text content from the Html tree. */
export function collectText(root: HtmlProbeNode): string {
  const parts: string[] = [];
  walk(root, (node) => {
    if (isTextNode(node)) {
      parts.push(node);
      return;
    }
    if ('_tag' in node && node._tag === 'Text') parts.push(node.value);
  });
  return parts.join('');
}

/** Collect all values of a specific attribute from any element in the tree. */
export function collectAttr(root: HtmlProbeNode, attrName: string): ReadonlyArray<string> {
  const found: string[] = [];
  walk(root, (node) => {
    if (!isElementNode(node) || node.attributes === undefined) return;
    for (const attribute of node.attributes) {
      const tag = attribute._tag;
      const value = attribute.value;
      if (value === undefined) continue;
      const normalised =
        tag === undefined
          ? ''
          : tag
              .toLowerCase()
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase();
      if (
        normalised === attrName ||
        normalised === attrName.replace(/^aria-/, 'aria') ||
        attribute.name === attrName
      ) {
        found.push(value);
      }
    }
  });
  return found;
}

/** Count the number of SVG elements with a given tag name in the tree. */
export function countElements(root: HtmlProbeNode, tagName: string): number {
  let count = 0;
  walk(root, (node) => {
    if (isElementNode(node) && node.tag === tagName) count++;
  });
  return count;
}

/** Find all nodes matching a predicate. */
export function findNodes(
  root: HtmlProbeNode,
  predicate: (node: HtmlProbeNode) => boolean,
): ReadonlyArray<HtmlProbeNode> {
  const found: HtmlProbeNode[] = [];
  walk(root, (node) => {
    if (predicate(node)) found.push(node);
  });
  return found;
}
