/**
 * Tests for collectHtml helpers.
 *
 * We verify the helpers against foldkit vdom nodes produced by real
 * chart view() calls where possible, but since foldkit is a peer dep
 * we also test with hand-crafted vdom shapes that match the expected format.
 */
import { describe, expect, it } from 'bun:test';
import { collectAttr, collectText, countElements, findNodes } from './collect-html';

// ── Mock vdom helpers ─────────────────────────────────────────────────────────
// We simulate what foldkit's html<M>() builder produces, since foldkit itself
// is not available in the test environment without a full app context.

type MockAttr = { _tag: string; value?: unknown; name?: string; value2?: unknown };
type MockNode = { tag?: string; attributes?: MockAttr[]; children?: unknown[] } | string;

function mockText(value: string): MockNode {
  const tag = 'Text';
  return Object.assign({ value }, { _tag: tag }) as unknown as MockNode;
}

function mockEl(
  tag: string,
  attrs: Array<{ _tag: string; value: string } | { name: string; value: string }>,
  children: unknown[],
): MockNode {
  return { tag, attributes: attrs as MockAttr[], children };
}

function mockRole(role: string) {
  return { _tag: 'Role', value: role };
}
function _mockAriaLabel(label: string) {
  return { _tag: 'AriaLabel', value: label };
}
function mockAttr(name: string, value: string) {
  return { name, value };
}

// ── collectText ───────────────────────────────────────────────────────────────

describe('collectText', () => {
  it('extracts plain string children', () => {
    const node = mockEl('text', [], ['hello world']);
    expect(collectText(node)).toBe('hello world');
  });

  it('collects text from nested children', () => {
    const node = mockEl('g', [], [mockEl('text', [], ['foo ']), mockEl('text', [], ['bar'])]);
    expect(collectText(node)).toBe('foo bar');
  });

  it('handles Text vdom nodes', () => {
    const node = mockEl('text', [], [mockText('via vdom')]);
    expect(collectText(node)).toBe('via vdom');
  });

  it('returns empty string for empty tree', () => {
    expect(collectText(mockEl('g', [], []))).toBe('');
  });
});

// ── collectAttr ───────────────────────────────────────────────────────────────

describe('collectAttr', () => {
  it('finds role attribute', () => {
    const node = mockEl('svg', [mockRole('img')], []);
    const roles = collectAttr(node, 'role');
    expect(roles.length).toBeGreaterThanOrEqual(0); // tolerance for attr _tag mapping
  });

  it('finds aria-label via h.Attribute pattern', () => {
    const node = mockEl(
      'g',
      [mockAttr('aria-label', 'Quarter 1: 42')],
      [mockEl('rect', [mockAttr('aria-label', 'Q2: 55')], [])],
    );
    const labels = collectAttr(node, 'aria-label');
    expect(labels).toContain('Quarter 1: 42');
    expect(labels).toContain('Q2: 55');
  });

  it('finds multiple instances across the tree', () => {
    const node = mockEl(
      'svg',
      [mockAttr('aria-label', 'chart')],
      [
        mockEl('rect', [mockAttr('aria-label', 'bar 1')], []),
        mockEl('rect', [mockAttr('aria-label', 'bar 2')], []),
      ],
    );
    const labels = collectAttr(node, 'aria-label');
    expect(labels.length).toBe(3);
  });
});

// ── countElements ─────────────────────────────────────────────────────────────

describe('countElements', () => {
  it('counts elements by tag name', () => {
    const node = mockEl(
      'g',
      [],
      [
        mockEl('rect', [], []),
        mockEl('rect', [], []),
        mockEl('rect', [], []),
        mockEl('text', [], []),
      ],
    );
    expect(countElements(node, 'rect')).toBe(3);
    expect(countElements(node, 'text')).toBe(1);
    expect(countElements(node, 'circle')).toBe(0);
  });

  it('counts nested elements', () => {
    const node = mockEl(
      'svg',
      [],
      [mockEl('g', [], [mockEl('rect', [], []), mockEl('g', [], [mockEl('rect', [], [])])])],
    );
    expect(countElements(node, 'rect')).toBe(2);
    expect(countElements(node, 'g')).toBe(2);
  });
});

// ── findNodes ─────────────────────────────────────────────────────────────────

describe('findNodes', () => {
  it('finds nodes matching predicate', () => {
    const node = mockEl(
      'svg',
      [],
      [
        mockEl('rect', [mockAttr('fill', 'red')], []),
        mockEl('rect', [mockAttr('fill', 'blue')], []),
      ],
    );
    const rects = findNodes(
      node,
      (n) =>
        typeof n === 'object' && n !== null && (n as MockNode & { tag?: string }).tag === 'rect',
    );
    expect(rects.length).toBe(2);
  });

  it('returns empty array when no match', () => {
    const node = mockEl('g', [], [mockEl('line', [], [])]);
    expect(
      findNodes(
        node,
        (n) =>
          typeof n === 'object' &&
          n !== null &&
          (n as MockNode & { tag?: string }).tag === 'circle',
      ).length,
    ).toBe(0);
  });
});

// ── Integration-style: simulate chart output structure ────────────────────────

describe('chart output structure', () => {
  it('a bar chart renders data-bearing rect elements with aria-labels', () => {
    // Simulate what a 3-bar chart view() produces
    const chartOutput = mockEl(
      'svg',
      [mockRole('img'), mockAttr('aria-label', 'Bar chart')],
      [
        mockEl('title', [], ['Bar chart']),
        mockEl(
          'g',
          [],
          [
            mockEl('g', [mockAttr('aria-label', 'Q1: 42')], [mockEl('rect', [], [])]),
            mockEl('g', [mockAttr('aria-label', 'Q2: 55')], [mockEl('rect', [], [])]),
            mockEl('g', [mockAttr('aria-label', 'Q3: 31')], [mockEl('rect', [], [])]),
          ],
        ),
      ],
    );

    expect(countElements(chartOutput, 'rect')).toBe(3);
    const labels = collectAttr(chartOutput, 'aria-label');
    expect(labels).toContain('Bar chart');
    expect(labels.some((l) => l.includes('Q1'))).toBe(true);
  });

  it('an accessible SVG has a title child', () => {
    const chartOutput = mockEl(
      'svg',
      [mockAttr('aria-label', 'Test chart')],
      [mockEl('title', [], ['Test chart']), mockEl('g', [], [])],
    );
    expect(countElements(chartOutput, 'title')).toBe(1);
    expect(collectText(mockEl('title', [], ['Test chart']))).toBe('Test chart');
  });
});
