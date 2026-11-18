import sax from 'sax';
import type { QualifiedAttribute } from 'sax';

import type {
  PhosphorAttribute,
  PhosphorAttributes,
  PhosphorElement,
  PhosphorIconDefinition,
  PhosphorTag,
} from './types';

const tags: readonly PhosphorTag[] = [
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
];
const names: readonly PhosphorAttribute[] = [
  'd',
  'fill',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
  'x',
  'y',
  'width',
  'height',
  'rx',
  'ry',
  'cx',
  'cy',
  'r',
  'x1',
  'x2',
  'y1',
  'y2',
  'points',
];
const isTag = (name: string): name is PhosphorTag => tags.some((tag) => tag === name);
const isAttribute = (name: string): name is PhosphorAttribute =>
  names.some((attribute) => attribute === name);
const isPlain = (value: string | QualifiedAttribute): value is string => typeof value === 'string';
type BuildingElement = {
  tag: PhosphorTag;
  attributes: PhosphorAttributes;
  children: PhosphorElement[];
};

/** Build-time compiler for pinned Core assets. Not a general SVG upload sanitizer.
 * Rejects unsupported content, preserves exact passive geometry, and freezes data.
 */
export function compilePhosphorIcon(source: string): PhosphorIconDefinition {
  if (source.length === 0 || source.length > 131072 || /<!|<\?/.test(source))
    throw new RangeError('Phosphor SVG must be a bounded static asset without declarations');
  // sax supports strictEntities at runtime; @types/sax omits that option.
  const parseOptions = { xmlns: false, trim: false, strictEntities: true };
  const xml = sax.parser(true, parseOptions);
  const stack: BuildingElement[] = [];
  const children: PhosphorElement[] = [];
  let root: PhosphorAttributes | undefined;
  let closed = false;
  xml.onerror = () => {
    throw new RangeError('Malformed Phosphor SVG');
  };
  xml.ontext = (text) => {
    if (text.trim() !== '') throw new RangeError('Phosphor SVG cannot contain text');
  };
  xml.onopentag = (tag) => {
    const top = root === undefined;
    if (closed || (top ? tag.name !== 'svg' : !isTag(tag.name)))
      throw new RangeError('Unsupported Phosphor SVG element');
    const accepted: Partial<Record<PhosphorAttribute, string>> = {};
    for (const [name, value] of Object.entries(tag.attributes)) {
      if (!isPlain(value)) throw new RangeError('Qualified SVG attributes are unsupported');
      if (top && ['xmlns', 'viewBox', 'width', 'height'].includes(name)) {
        if (
          (name === 'xmlns' && value !== 'http://www.w3.org/2000/svg') ||
          (name === 'viewBox' && value !== '0 0 256 256')
        )
          throw new RangeError('Expected the Phosphor SVG namespace and 256-unit viewBox');
        continue;
      }
      if (!isAttribute(name) || /url\s*\(|javascript:|data:/i.test(value))
        throw new RangeError('Unsupported Phosphor SVG attribute or resource');
      if (
        (name === 'fill' || name === 'stroke') &&
        !/^(?:currentColor|none|transparent|#[0-9a-fA-F]{3,8})$/.test(value)
      )
        throw new RangeError('Phosphor paint must be a static colour or currentColor');
      accepted[name] = value;
    }
    if (top) {
      if (tag.attributes.viewBox !== '0 0 256 256')
        throw new RangeError('Missing Phosphor viewBox');
      root = Object.freeze(accepted);
    } else {
      // SAFETY: the non-root element name passed isTag above before reaching this branch.
      const name = tag.name as PhosphorTag;
      if (stack.length >= 16) throw new RangeError('Phosphor SVG nesting is too deep');
      stack.push({ tag: name, attributes: Object.freeze(accepted), children: [] });
    }
  };
  xml.onclosetag = (name) => {
    if (name === 'svg') {
      closed = true;
      return;
    }
    const node = stack.pop();
    if (!node) throw new RangeError('Unbalanced Phosphor SVG');
    const result = Object.freeze({ ...node, children: Object.freeze(node.children) });
    const parent = stack[stack.length - 1];
    (parent ? parent.children : children).push(result);
  };
  xml.write(source).close();
  if (!closed || root === undefined || children.length === 0)
    throw new RangeError('Phosphor SVG requires a complete root and artwork');
  return Object.freeze({
    viewBox: '0 0 256 256',
    attributes: root,
    children: Object.freeze(children),
  });
}
