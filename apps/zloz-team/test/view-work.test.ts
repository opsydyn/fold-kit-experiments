import { expect, test } from 'bun:test';

import { BrowserHost, Html } from '@effect/ui/html';
import { createOperationDocument, decideOperation } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { init, Message, update, view } from '../src/editor/main';
import { renderBoard } from './render-native';

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
    const rendered = await renderBoard(model);
    const selected = update(
      model,
      Message.ObservedEditorInput({ event: { type: 'NodeSelected', id: 'n1', additive: false } }),
    ).model;
    const selectedView = await renderBoard(selected);
    const handle = (id: string) =>
      selectedView.html.match(new RegExp(`<button[^>]*data-flow-handle="${id}"[^>]*>`))?.[0];
    expect(handle('n1')).toContain('aria-pressed="true"');
    expect(handle('n0')).toContain('aria-pressed="false"');
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
    expect((await renderBoard(withPeer)).html).toContain('↖ Cursor peer');
    expect((await renderBoard(ownCursor)).html).not.toContain('↖ Cursor peer');
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
    const renamedView = await renderBoard(changed);
    expect(renamedView.html).toContain('Peer renamed');
    expect(renamedView.html.match(/data-flow-node=/g)).toHaveLength(250);
    expect(renamedView.html.match(/data-flow-port=/g)).toHaveLength(500);
    // Count declarations to keep the limit independent of the test host.
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
    const { document } = new Window();
    let buttonCount = 0;
    const fixture = Html.component({
      name: 'TeamsBoardWork',
      model: Schema.Number,
      message: Message,
    }).make({
      init: () => 0,
      update: ($, message) =>
        message._tag === 'ClickedUndo' || message._tag === 'ClickedRetry' ? $.model + 1 : $.model,
      view: (h, count) => {
        const counted: Html.H<Message> = new Proxy(h, {
          get(target, key, receiver) {
            if (key === 'button') buttonCount++;
            // oxlint-disable-next-line anti-slop/no-reflect-get -- Preserve getters and lazy receivers on the real HTML helper while counting button creation.
            return Reflect.get(target, key, receiver);
          },
        });
        return view(count < 2 ? model : changed, counted).body;
      },
    });
    const checkReuse = Effect.gen(function* () {
      const happyBody: unknown = document.body;
      // SAFETY: Happy DOM implements the browser surface that BrowserHost consumes.
      const body = happyBody as HTMLElement;
      const root = yield* BrowserHost.mountEffect(fixture, {}, body);
      const first = buttonCount;
      buttonCount = 0;
      root.send(Message.ClickedUndo());
      yield* Effect.promise(() => new Promise<void>(queueMicrotask));
      const repeated = buttonCount;
      buttonCount = 0;
      root.send(Message.ClickedRetry());
      yield* Effect.promise(() => new Promise<void>(queueMicrotask));
      expect(document.body.textContent).toContain('Peer renamed');
      expect(first - repeated).toBeGreaterThanOrEqual(1000);
      expect(repeated).toBeLessThanOrEqual(3);
      expect(buttonCount).toBeLessThanOrEqual(16);
    });
    const scoped = Effect.scoped(checkReuse);
    await Effect.runPromise(scoped);
  },
);
