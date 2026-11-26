import { expect, test } from 'bun:test';

import { createEditor, createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import { zlozNodeFrame, zlozPort, zlozView } from '@opsydyn/foldkit-zloz/foldkit';
import { Data, Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Lazy } from 'foldkit/test';

import { init, Message, update, view } from '../src/editor/main';
import { sharedNodeFrame } from '../src/editor/node-frame';
import { createPortsView } from '../src/editor/ports-view';

class MissingPortControl extends Data.TaggedError('MissingPortControl') {}

test.each([false, true])(
  'private node frame preserves native delivery markup (preview=%s)',
  async (preview) => {
    const model = createEditor({
      nodes: [
        {
          id: 'node',
          label: 'Frame <&>',
          position: { x: -27.5, y: 46.25 },
          size: { width: 173, height: 91 },
          ports: [],
        },
      ],
      edges: [],
    });
    const rendered: string[] = [];
    for (const native of [true, false]) {
      const result = await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model }),
            view: (state, h: HtmlBuilder<Message>) => ({
              title: 'Frame parity',
              body: zlozView(h, state, {
                id: 'frame',
                label: 'Frame',
                onEvent: () => Message.ClickedAdd(),
                renderNodeShell: (current, builder) => {
                  const context = { ...current, selectionPreview: preview };
                  const draw = native ? zlozNodeFrame : sharedNodeFrame;
                  return draw(
                    builder,
                    context,
                    [
                      builder.Class('shared-node'),
                      builder.Style({ height: `${context.node.size.height}px` }),
                    ],
                    [builder.span([], [context.node.label])],
                  );
                },
              }),
            }),
          },
          { flags: {}, isHydratable: false },
        ),
      );
      rendered.push(result.html);
    }
    const [native = '', shared = ''] = rendered;
    expect(rendered).toHaveLength(2);
    const semantics = (html: string) => html.replace(/ (?:style|class)="[^"]*"/g, '');
    expect(semantics(shared)).toBe(semantics(native));
    expect(shared).toContain('data-flow-x="-27.5"');
    expect(shared).toContain('data-flow-y="46.25"');
    expect(shared.includes('data-flow-selection-preview="true"')).toBe(preview);
    expect(shared).toContain('shared-node-frame');
  },
);

test('retained port controls preserve native semantics as current policy and geometry change', async () => {
  const ports = createPortsView<Message>();
  const graph = {
    nodes: [
      {
        id: 'node',
        label: 'Original',
        position: { x: 20, y: 30 },
        size: { width: 150, height: 80 },
        ports: [{ id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
      },
    ],
    edges: [],
  };
  for (const readOnly of [false, true]) {
    for (const active of [false, true]) {
      for (const reason of [null, 'Current policy denies this port']) {
        for (const target of [false, true]) {
          const state = {
            ...createEditor({
              ...graph,
              nodes: graph.nodes.map((node) => ({
                ...node,
                label: active ? 'Renamed' : node.label,
                ports: node.ports.map((port) => {
                  const kind = readOnly ? ('output' as const) : port.kind;
                  return target
                    ? {
                        id: port.id,
                        side: port.side,
                        kind,
                        anchor: { x: 0.25, y: 0.75 },
                        label: 'Anchored port',
                      }
                    : { ...port, kind };
                }),
              })),
            }),
            readOnly,
            connection: active ? { node: 'node', port: 'in' } : null,
          };
          const result = await Effect.runPromise(
            renderToString(
              {
                Flags: Schema.Struct({}),
                init: () => ({ model: state }),
                view: (model, h: HtmlBuilder<Message>) => ({
                  title: 'Port parity',
                  body: zlozView(h, model, {
                    id: 'ports',
                    label: 'Ports',
                    onEvent: () => Message.ClickedAdd(),
                    canConnectPort: () => reason,
                    renderPort: (current, builder) => {
                      const context = { ...current, target };
                      // Prime this same node/port slot with the previous access
                      // state; only the current control is mounted below.
                      ports(
                        { ...context, state: { ...context.state, readOnly: !model.readOnly } },
                        builder,
                      );
                      const retained = ports(context, builder);
                      if (!retained) throw new MissingPortControl();
                      return builder.div(
                        [],
                        [
                          zlozPort(
                            builder,
                            context,
                            context.port,
                            [],
                            [context.port.kind === 'output' ? '+' : '−'],
                          ),
                          retained,
                        ],
                      );
                    },
                  }),
                }),
              },
              { flags: {}, isHydratable: false },
            ),
          );
          const buttons = result.html.match(
            /<button\b[^>]*data-flow-port="in"[^>]*>.*?<\/button>/g,
          );
          expect(buttons).toHaveLength(2);
          const semantic = (text: string) => text.replace(/ (?:style|class)="[^"]*"/g, '');
          expect(semantic(buttons![1]!)).toBe(semantic(buttons![0]!));
          const styles = buttons!.map((text) => /style="([^"]*)"/.exec(text)![1]!);
          for (const property of ['left', 'top'])
            expect(styles[1]!.match(new RegExp(`${property}:\\s*([^;]+)`))?.[1]).toBe(
              styles[0]!.match(new RegExp(`${property}:\\s*([^;]+)`))?.[1],
            );
          expect(buttons![1]!.includes('is-target')).toBe(target);
        }
      }
    }
  }
});

test.each(['owner', 'viewer'] as const)(
  'the live %s graph keeps every control within the inline style work budget',
  async (role) => {
    const nodes = Array.from({ length: 250 }, (_, index) => ({
      id: `n${index}`,
      label: `Node ${index}`,
      position: { x: (index % 10) * 180, y: Math.floor(index / 10) * 120 },
      size: { width: 150, height: 80 },
      ports: [
        { id: 'in', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
        { id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      ],
    }));
    const edges = Array.from({ length: 500 }, (_, index) => ({
      id: `e${index}`,
      source: { node: `n${index % 250}`, port: 'out' },
      target: { node: `n${((index % 250) + (index < 250 ? 1 : 10)) % 250}`, port: 'in' },
    }));
    const started = update(
      init({ teamId: 'team', diagramId: 'diagram', actorId: 'actor', role, name: 'View' }).model,
      Message.SucceededIdentity({ generation: 'view-generation' }),
    ).model;
    const model = update(
      started,
      Message.ObservedFrame({
        run: 0,
        room: started.room,
        frame: {
          target: started.room,
          sourceVersion: 0,
          document: createOperationDocument({ nodes, edges }),
          coverage: [],
        },
      }),
    ).model;
    const rendered = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (current, builder: HtmlBuilder<Message>) => {
            // Prime the same canvas with the previous access level. Only the
            // current role's view is mounted and measured below.
            view({ ...current, role: role === 'viewer' ? 'owner' : 'viewer' }, builder);
            return view(current, builder);
          },
        },
        { flags: {}, isHydratable: false },
      ),
    );
    const selected = update(
      model,
      Message.ObservedEditorInput({ event: { type: 'NodeSelected', id: 'n1', additive: false } }),
    ).model;
    const selectedView = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: selected }),
          view: (next, builder: HtmlBuilder<Message>) => {
            view(model, builder);
            return view(next, builder);
          },
        },
        { flags: {}, isHydratable: false },
      ),
    );
    expect(selectedView.html).toMatch(/<button[^>]*data-flow-handle="n1"[^>]*aria-pressed="true"/);
    expect(selectedView.html).toMatch(/<button[^>]*data-flow-handle="n0"[^>]*aria-pressed="false"/);
    const peer = {
      connectionId: 'other-connection',
      actorId: 'other-actor',
      name: 'Cursor peer',
      selection: [],
      cursor: { x: 20, y: 30 },
      seenAt: 0,
    };
    const withPeer = { ...model, peers: [peer] };
    const selfRoom = { ...model.room, generation: peer.connectionId };
    const ownCursor = {
      ...withPeer,
      room: selfRoom,
      session: { ...model.session, room: selfRoom },
    };
    for (const [previous, current, visible] of [
      [model, withPeer, true],
      [withPeer, ownCursor, false],
    ] as const) {
      const peers = await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: current }),
            view: (next, builder: HtmlBuilder<Message>) => {
              view(previous, builder);
              return view(next, builder);
            },
          },
          { flags: {}, isHydratable: false },
        ),
      );
      expect(peers.html.includes('↖ Cursor peer')).toBe(visible);
    }
    const rename = decideOperation(
      model.session.confirmed!.document,
      {
        version: 1,
        operationId: 'peer-rename',
        operation: { type: 'RenameNode', id: 'n0', expected: 0, label: 'Peer renamed' },
      },
      { actorId: 'peer', teamId: model.room.teamId, diagramId: model.room.diagramId },
    );
    expect(rename.receipt.status).toBe('accepted');
    const changed = update(
      model,
      Message.ObservedFrame({
        run: 0,
        room: model.room,
        frame: {
          target: model.room,
          sourceVersion: 1,
          document: { ...rename.document, undo: [] },
          coverage: [],
        },
      }),
    ).model;
    expect(changed.session.confirmed?.document.graph.nodes[0]?.label).toBe('Peer renamed');
    let rebuilt = 0;
    const renamedView = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: changed }),
          view: (next, builder: HtmlBuilder<Message>) => {
            const counted = {
              ...builder,
              button: (
                attributes: Parameters<HtmlBuilder<Message>['button']>[0],
                children: Parameters<HtmlBuilder<Message>['button']>[1],
              ) => {
                rebuilt++;
                return builder.button(attributes, children);
              },
            };
            view(model, counted);
            rebuilt = 0;
            return view(next, counted);
          },
        },
        { flags: {}, isHydratable: false },
      ),
    );
    expect(renamedView.html).toContain('Peer renamed');
    expect(renamedView.html.match(/data-flow-node=/g)).toHaveLength(250);
    expect(renamedView.html.match(/data-flow-port=/g)).toHaveLength(500);
    expect(rebuilt).toBeLessThanOrEqual(16);
    // Work units rather than a host-dependent wall-clock assertion. FoldKit must
    // reflect/validate these declarations for every view; static artwork belongs in CSS.
    const declarations = [...rendered.html.matchAll(/style="([^"]*)"/g)].reduce(
      (count, match) => count + match[1]!.split(';').filter((value) => value.trim()).length,
      0,
    );
    expect(rendered.html.match(/data-flow-node=/g)).toHaveLength(250);
    expect(rendered.html.match(/data-flow-port=/g)).toHaveLength(500);
    expect(rendered.html.match(/data-flow-port-kind="output"/g)).toHaveLength(250);
    expect(rendered.html.match(/<button[^>]*data-flow-port=[^>]*disabled/g) ?? []).toHaveLength(
      role === 'viewer' ? 500 : 0,
    );
    expect(rendered.html.match(/data-flow-resize=/g) ?? []).toHaveLength(
      role === 'owner' ? 250 : 0,
    );
    expect(rendered.html.match(/<button[^>]*aria-label="Node \d+ → Node \d+"/g)).toHaveLength(500);
    expect(rendered.html).toContain('Node 0 → Node 1');
    expect(rendered.html).toContain('Node 249 → Node 9');
    for (const menu of ['file', 'edit', 'view', 'arrange', 'help']) {
      expect(rendered.html).toContain(`popovertarget="board-menu-${menu}"`);
      expect(rendered.html).toContain(`id="board-menu-${menu}"`);
    }
    expect(rendered.html.includes('Team settings')).toBe(role === 'owner');
    // Exercise a confirmed live editor, including all 250 writable resize controls.
    // The budget cannot be met by rendering the unconfirmed read-only opening state.
    expect(declarations).toBeLessThan(4_500);
    // The complete connection list stays mounted. Repeated renders of the same
    // state must reuse its 500 connection and 500 port buttons.
    let buttonCount = 0;
    let counted: HtmlBuilder<Message> | undefined;
    const counts: number[] = [];
    Lazy.expectAllReused<typeof model, Message>({
      model,
      view: (current, builder: HtmlBuilder<Message>) => {
        counted ??= {
          ...builder,
          button: (attributes, children) => {
            buttonCount++;
            return builder.button(attributes, children);
          },
        };
        buttonCount = 0;
        const document = view(current, counted);
        counts.push(buttonCount);
        return document;
      },
    });
    expect(counts[0]! - counts[1]!).toBeGreaterThanOrEqual(1000);
    expect(counts[1]).toBe(3);
  },
);
