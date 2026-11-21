// Native Worker requests, stream readers and Workflow retries use exceptions at the platform boundary.
/* oxlint-disable linteffect/no-try-catch */
import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { Data, Schema } from 'effect';

import {
  Apply,
  artwork,
  CaptureRoom,
  EditLedgerEntry,
  Id,
  InviteSeats,
  isAccountId,
  initialScene,
  LedgerRevision,
  mayMove,
  Move,
  partyEntryFor,
  PublishLedgerEntry,
  Reveal,
  roomIdentity,
  seats,
  Start,
  type ArtKind,
  type Job,
  type LedgerEntry,
  type Participant,
  type Role,
  type RoomNotice,
  type RoomView,
  type Scene,
  type Token,
} from './contracts';

type Generation = { teamId: string; id: string };
type Lobby = { dm: string; players: readonly string[]; joined: readonly string[] };
const lobbyKey = 'lobby';
const roomDeliveryLeaseMs = 60_000;
const isDeliveryExpiry = Schema.is(Schema.Int);

interface Env {
  ROOM: DurableObjectNamespace<QuestRoom>;
  SPRITES: R2Bucket;
  GENERATE: Workflow<Generation>;
  ASSETS: Fetcher;
}

const sceneKey = 'scene';
const currentJobKey = 'recent-job';
const currentBackdropKey = 'recent-backdrop';
const jobKey = (id: string) => 'jobs/' + id;
const ledgerPrefix = 'ledger/';
const ledgerKey = (id: number) => ledgerPrefix + id;
const objectKey = (teamId: string, kind: ArtKind, id: string) =>
  teamId + '/' + kind + 's/' + id + '.png';
const roomOf = (env: Env, teamId: string) => env.ROOM.getByName(teamId);
function participantFor(lobby: Lobby | undefined, userId: string): Participant | undefined {
  if (!lobby) return undefined;
  if (lobby.dm === userId) return { role: 'dm', joined: true };
  const seat = seats[lobby.players.indexOf(userId)];
  return seat ? { role: 'player', seat, joined: lobby.joined.includes(userId) } : undefined;
}
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = <Value>(value: Value, status = 200) => Response.json(value, { status, headers });
const deny = (status: number, reason: string) => json({ error: reason }, status);
const pip = (scene: Scene) => scene.tokens[0]!;
async function readScene(store: DurableObjectStorage | DurableObjectTransaction): Promise<Scene> {
  const saved = await store.get<Omit<Scene, 'backdrop'> & Partial<Pick<Scene, 'backdrop'>>>(
    sceneKey,
  );
  return saved ? { ...saved, backdrop: saved.backdrop ?? initialScene.backdrop } : initialScene;
}
const sceneWith = (scene: Scene, token: Token): Scene => ({
  ...scene,
  version: scene.version + 1,
  tokens: scene.tokens.map((current) => (current.id === token.id ? token : current)),
});

export class QuestRoom extends DurableObject<Env> {
  async fetch(request: Request) {
    const userId = request.headers.get('x-quest-user');
    if (request.method !== 'GET' || request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      return deny(426, 'WebSocket upgrade required');
    if (!isAccountId(userId)) return deny(404, 'Table unavailable');
    const participant = await this.participant(userId);
    if (!participant) return deny(404, 'Table unavailable');
    if (!participant.joined) return deny(403, 'Join the party first.');
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [participant.role]);
    server.serializeAttachment(Date.now() + roomDeliveryLeaseMs);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket) {
    // oxlint-disable-next-line linteffect/no-manual-resource-close -- The Durable Object runtime owns accepted sockets.
    socket.close(1008, 'This connection only sends room updates');
  }

  #notify(notice: RoomNotice, role?: Role) {
    const now = Date.now();
    for (const socket of this.ctx.getWebSockets(role)) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const expires = socket.deserializeAttachment();
      try {
        if (!isDeliveryExpiry(expires) || expires <= now)
          // oxlint-disable-next-line linteffect/no-manual-resource-close -- Closing delivers the authorization expiry to this client.
          socket.close(4000, 'Room authorization needs renewal');
        else socket.send(notice);
      } catch {
        // A disconnected receiver cannot affect a committed command or the remaining receivers.
      }
    }
  }

  async participant(userId: string) {
    return participantFor(await this.ctx.storage.get<Lobby>(lobbyKey), userId);
  }

  async host(dm: string, players: typeof InviteSeats.Type) {
    return this.ctx.storage.transaction(async (store) => {
      const lobby = await store.get<Lobby>(lobbyKey);
      if (lobby)
        return lobby.dm === dm && players.every((player, index) => player === lobby.players[index]);
      await store.put(lobbyKey, { dm, players, joined: [] } satisfies Lobby);
      return true;
    });
  }

  async join(userId: string) {
    return this.ctx.storage.transaction(async (store) => {
      const lobby = await store.get<Lobby>(lobbyKey);
      const participant = participantFor(lobby, userId);
      if (!lobby || participant?.role !== 'player') return false;
      if (!participant.joined)
        await store.put(lobbyKey, { ...lobby, joined: [...lobby.joined, userId] });
      return true;
    });
  }

  async view(role: Role): Promise<RoomView> {
    return this.ctx.storage.transaction(async (store) => {
      const scene = await readScene(store);
      if (role === 'player') return { ...scene, role };
      const id = await store.get<string>(currentJobKey);
      const job = id ? await store.get<Job>(jobKey(id)) : undefined;
      const backdropId = await store.get<string>(currentBackdropKey);
      const backdropJob = backdropId ? await store.get<Job>(jobKey(backdropId)) : undefined;
      return Object.assign(
        { ...scene, role },
        job && job.kind !== 'backdrop' ? { job } : undefined,
        backdropJob?.kind === 'backdrop' ? { backdropJob } : undefined,
      );
    });
  }

  async readJob(id: string) {
    return (await this.ctx.storage.get<Job>(jobKey(id))) ?? null;
  }

  async reserve(input: typeof Start.Type) {
    const result = await this.ctx.storage.transaction(async (store) => {
      const previous = await store.get<Job>(jobKey(input.id));
      if (previous) {
        if (previous.prompt !== input.prompt) return undefined;
        if (input.kind === 'backdrop')
          return previous.kind === 'backdrop' && previous.title === input.title ? previous : null;
        return previous.kind === 'backdrop' ? null : previous;
      }
      const scene = await readScene(store);
      const job: Job = {
        ...input,
        status: 'pending',
        assetId: crypto.randomUUID(),
        artVersion: input.kind === 'backdrop' ? scene.backdrop.revision : pip(scene).artVersion,
      };
      const current = input.kind === 'backdrop' ? currentBackdropKey : currentJobKey;
      await store.put({ [jobKey(input.id)]: job, [current]: input.id });
      return job;
    });
    if (result) this.#notify('room', 'dm');
    return result;
  }

  async settle(id: string, status: 'ready' | 'failed') {
    const changed = await this.ctx.storage.transaction(async (store) => {
      const job = await store.get<Job>(jobKey(id));
      if (job?.status !== 'pending') return false;
      await store.put(jobKey(id), { ...job, status });
      return true;
    });
    if (changed) this.#notify('room', 'dm');
  }

  async apply(id: string) {
    const result = await this.ctx.storage.transaction(async (store) => {
      const job = await store.get<Job>(jobKey(id));
      if (!job || job.kind === 'backdrop') return undefined;
      const scene = await readScene(store);
      if (job?.status === 'applied') return { version: job.version };
      if (job?.status !== 'ready' || job.artVersion !== pip(scene).artVersion) return undefined;
      const current = pip(scene);
      const next = sceneWith(scene, {
        ...current,
        artVersion: current.artVersion + 1,
        assetId: job.assetId,
      });
      await store.put({
        [sceneKey]: next,
        [jobKey(id)]: { ...job, status: 'applied', version: next.version },
      });
      return { version: next.version };
    });
    if (result) this.#notify('room');
    return result;
  }

  async reveal({ id, style }: typeof Reveal.Type) {
    const result = await this.ctx.storage.transaction(async (store) => {
      const job = await store.get<Job>(jobKey(id));
      if (job?.kind !== 'backdrop') return undefined;
      if (style === 'plain' && job.plainVersion !== undefined) return { version: job.plainVersion };
      if (style === 'generated' && job.status === 'applied') return { version: job.version };
      if (job.status === 'applied' || (style === 'generated' && job.status !== 'ready'))
        return undefined;

      const scene = await readScene(store);
      if (
        scene.backdrop.revision !== job.artVersion &&
        scene.backdrop.revision !== job.plainVersion
      )
        return undefined;

      const version = scene.version + 1;
      const backdrop = {
        title: job.title,
        revision: version,
        roomRevision: job.plainVersion ?? version,
      };
      const next: Scene = {
        ...scene,
        version,
        backdrop:
          style === 'plain' ? { ...backdrop, style } : { ...backdrop, style, assetId: job.assetId },
      };
      const updatedJob: Job =
        style === 'plain'
          ? { ...job, plainVersion: version }
          : { ...job, status: 'applied', version };
      await store.put({ [sceneKey]: next, [jobKey(id)]: updatedJob });
      return { version };
    });
    if (result) this.#notify('room');
    return result;
  }

  async ledger() {
    const entries = await this.ctx.storage.list<LedgerEntry>({ prefix: ledgerPrefix });
    return Array.from(entries.values()).sort((left, right) => right.id - left.id);
  }

  async partyLedger() {
    const entries = await this.ledger();
    return entries.flatMap((entry) =>
      entry.published ? [partyEntryFor(entry, entry.published)] : [],
    );
  }

  async ledgerBackdrop(id: number, requiresPublication: boolean) {
    const entry = await this.ctx.storage.get<LedgerEntry>(ledgerKey(id));
    if (!entry || (requiresPublication && !entry.published)) return undefined;
    return entry.room.style === 'generated' ? entry.room.assetId : null;
  }

  async captureRoom(input: typeof CaptureRoom.Type) {
    return this.ctx.storage.transaction(async (store) => {
      const key = ledgerKey(input.roomId);
      const existing = await store.get<LedgerEntry>(key);
      if (existing) return existing;
      const { backdrop } = await readScene(store);
      if (roomIdentity(backdrop) !== input.roomId || backdrop.revision !== input.expectedBackdrop)
        return undefined;
      const entry: LedgerEntry = {
        id: input.roomId,
        room: backdrop,
        title: backdrop.title,
        notes: '',
        revision: 0,
      };
      await store.put(key, entry);
      return entry;
    });
  }

  async editLedgerEntry(input: typeof EditLedgerEntry.Type) {
    return this.ctx.storage.transaction(async (store) => {
      const key = ledgerKey(input.id);
      const entry = await store.get<LedgerEntry>(key);
      if (!entry) return { status: 'missing' as const };
      const same = entry.title === input.title && entry.notes === input.notes;
      if (entry.revision !== input.expectedRevision) {
        return same && entry.revision === input.expectedRevision + 1
          ? { status: 'saved' as const, entry }
          : { status: 'conflict' as const, entry };
      }
      if (same) return { status: 'saved' as const, entry };
      const updated = {
        ...entry,
        title: input.title,
        notes: input.notes,
        revision: entry.revision + 1,
      };
      await store.put(key, updated);
      return { status: 'saved' as const, entry: updated };
    });
  }

  async publishLedgerEntry(input: typeof PublishLedgerEntry.Type) {
    const result = await this.ctx.storage.transaction(async (store) => {
      const key = ledgerKey(input.id);
      const entry = await store.get<LedgerEntry>(key);
      if (!entry) return { status: 'missing' as const };
      const version = entry.published?.version ?? 0;
      const same = entry.published?.title === input.title && entry.published.recap === input.recap;
      if (version !== input.expectedVersion) {
        return same && version === input.expectedVersion + 1
          ? { status: 'saved' as const, entry }
          : { status: 'conflict' as const, entry };
      }
      if (same) return { status: 'saved' as const, entry };
      const updated: LedgerEntry = {
        ...entry,
        published: { title: input.title, recap: input.recap, version: version + 1 },
      };
      await store.put(key, updated);
      return { status: 'saved' as const, entry: updated };
    });
    if (result.status === 'saved') this.#notify('party-ledger', 'player');
    return result;
  }

  async move(participant: Participant, input: typeof Move.Type) {
    const result = await this.ctx.storage.transaction(async (store) => {
      if (!mayMove(participant, input.id)) return { status: 'denied' as const };
      const scene = await readScene(store);
      const current = scene.tokens.find((token) => token.id === input.id);
      if (!current || current.positionVersion !== input.expected)
        return { status: 'conflict' as const };
      if (current.x === input.x && current.y === input.y)
        return { status: 'saved' as const, version: scene.version };
      const next = sceneWith(scene, {
        ...current,
        x: input.x,
        y: input.y,
        positionVersion: current.positionVersion + 1,
      });
      await store.put(sceneKey, next);
      return { status: 'saved' as const, version: next.version };
    });
    if (result.status === 'saved') this.#notify('room');
    return result;
  }

  async appliedAssetKind(id: string): Promise<ArtKind | undefined> {
    const scene = await readScene(this.ctx.storage);
    if (scene.backdrop.style === 'generated' && scene.backdrop.assetId === id) return 'backdrop';
    return scene.tokens.some((token) => token.assetId === id) ? 'sprite' : undefined;
  }
}

class ArtworkRejected extends Data.TaggedError('ArtworkRejected')<{ reason: string }> {}

async function readPng(response: Response, kind: ArtKind) {
  if (!response.ok || response.headers.get('content-type') !== 'image/png')
    throw new ArtworkRejected({ reason: 'Generator failed' });
  const { width, height, maxBytes } = artwork[kind];
  const bytes = await boundedBytes(response, maxBytes);
  if (!bytes || bytes.length < 33)
    throw new ArtworkRejected({ reason: 'Invalid artwork response' });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0) !== 0x89504e47 ||
    view.getUint32(4) !== 0x0d0a1a0a ||
    view.getUint32(12) !== 0x49484452 ||
    view.getUint32(16) !== width ||
    view.getUint32(20) !== height
  ) {
    throw new ArtworkRejected({ reason: 'Unexpected artwork format or dimensions' });
  }
  return bytes;
}

export class SpriteWorkflow extends WorkflowEntrypoint<Env, Generation> {
  async run(event: WorkflowEvent<Generation>, step: WorkflowStep) {
    const { id, teamId } = event.payload;
    const room = roomOf(this.env, teamId);
    try {
      await step.do(
        'prepare sample artwork',
        { retries: { limit: 0, delay: '1 second' }, timeout: '55 seconds' },
        async () => {
          const job = await room.readJob(id);
          if (job?.status !== 'pending') return;
          const kind = job.kind ?? 'sprite';
          const response = await this.env.ASSETS.fetch('https://fixture.internal/' + kind + '.png');
          const bytes = await readPng(response, kind);
          await this.env.SPRITES.put(objectKey(teamId, kind, job.assetId), bytes, {
            httpMetadata: { contentType: 'image/png' },
          });
        },
      );
    } catch {
      await step.do('record failed generation', async () => room.settle(id, 'failed'));
      return;
    }
    await step.do('record the ready draft', async () => room.settle(id, 'ready'));
  }
}

async function boundedBytes(message: Request | Response, maxBytes: number) {
  const reader = message.body?.getReader();
  if (!reader) return undefined;
  const bytes = new Uint8Array(maxBytes);
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) return bytes.subarray(0, size);
      if (size + part.value.length > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      bytes.set(part.value, size);
      size += part.value.length;
    }
  } finally {
    reader.releaseLock();
  }
}

async function inputFor<Value>(
  request: Request,
  schema: Schema.Codec<Value, unknown, never>,
  maxBytes = 4096,
): Promise<Value | undefined> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return undefined;
  try {
    const bytes = await boundedBytes(request, maxBytes);
    return bytes
      ? Schema.decodeUnknownSync(schema)(JSON.parse(new TextDecoder().decode(bytes)))
      : undefined;
  } catch {
    return undefined;
  }
}

async function image(env: Env, teamId: string, kind: ArtKind, id: string) {
  const object = await env.SPRITES.get(objectKey(teamId, kind, id));
  return object
    ? new Response(object.body, { headers: { ...headers, 'Content-Type': 'image/png' } })
    : deny(404, 'Missing asset');
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const [, teamId, action, parameter, extra] = url.pathname.split('/');
    const userId = request.headers.get('x-quest-user');
    if (!isAccountId(teamId) || extra !== undefined || !isAccountId(userId))
      return deny(404, 'Table unavailable');
    const room = roomOf(env, teamId);
    // WebSocket upgrades cross the Durable Object fetch boundary as an intact response.
    if (action === 'live' && parameter === undefined) return room.fetch(request);
    if (request.method === 'POST' && parameter === undefined && action === 'host') {
      const players = await inputFor(request, InviteSeats);
      if (!players || new Set([userId, ...players]).size !== 4)
        return deny(400, 'Choose three different players.');
      return (await room.host(userId, players))
        ? json({ role: 'dm', joined: true })
        : deny(409, 'This team already has a Moonwell table.');
    }
    const participant = await room.participant(userId);
    if (!participant) return deny(404, 'Table unavailable');
    if (request.method === 'GET' && parameter === undefined && action === 'lobby')
      return json(participant);
    if (request.method === 'POST' && parameter === undefined && action === 'join')
      return (await room.join(userId))
        ? json({ joined: true })
        : deny(404, 'Invitation unavailable');
    if (!participant.joined) return deny(403, 'Join the party first.');
    const { role } = participant;
    if (request.method === 'GET') {
      if (action === 'room' && parameter === undefined) return json(await room.view(role));
      if (action === 'party-ledger' && parameter === undefined)
        return json(await room.partyLedger());
      if (role === 'dm' && action === 'ledger' && parameter === undefined)
        return json(await room.ledger());
      if (
        (action === 'party-art' || (role === 'dm' && action === 'ledger-art')) &&
        parameter &&
        /^(0|[1-9]\d*)$/.test(parameter)
      ) {
        const id = Number(parameter);
        const asset = Schema.is(LedgerRevision)(id)
          ? await room.ledgerBackdrop(id, action === 'party-art')
          : null;
        return asset ? image(env, teamId, 'backdrop', asset) : deny(404, 'Missing Ledger backdrop');
      }
      if (!Schema.is(Id)(parameter)) return deny(404, 'Not found');
      if (action === 'assets') {
        const kind = await room.appliedAssetKind(parameter);
        return kind ? image(env, teamId, kind, parameter) : deny(404, 'Not found');
      }
      if (role !== 'dm' || (action !== 'jobs' && action !== 'preview'))
        return deny(404, 'Not found');
      const job = await room.readJob(parameter);
      if (!job) return deny(404, 'Not found');
      if (action === 'jobs') return json(job);
      return job.status === 'ready' || job.status === 'applied'
        ? image(env, teamId, job.kind ?? 'sprite', job.assetId)
        : deny(404, 'Draft unavailable');
    }

    if (request.method !== 'POST' || parameter !== undefined) return deny(404, 'Not found');
    if (action === 'move') {
      const input = await inputFor(request, Move);
      if (!input) return deny(400, 'Invalid movement');
      const result = await room.move(participant, input);
      if (result.status === 'denied') return deny(403, 'This token belongs to someone else');
      return result.status === 'conflict'
        ? deny(409, 'Position changed. Try again.')
        : json(result);
    }
    if (role !== 'dm') return deny(403, 'Only the DM can make this change');
    if (action === 'ledger-capture') {
      const input = await inputFor(request, CaptureRoom);
      if (!input) return deny(400, 'Invalid room selection');
      const entry = await room.captureRoom(input);
      return entry
        ? json(entry)
        : deny(409, 'The visible room changed. Check the board and try again.');
    }
    if (action === 'ledger-edit') {
      const input = await inputFor(request, EditLedgerEntry, 12_000);
      if (!input) return deny(400, 'Enter an entry title and keep notes to 1,500 characters.');
      const result = await room.editLedgerEntry(input);
      if (result.status === 'missing') return deny(404, 'Ledger entry unavailable');
      if (result.status === 'conflict')
        return json(
          {
            error: 'Another DM tab saved this entry. Your edits are still here.',
            entry: result.entry,
          },
          409,
        );
      return json(result.entry);
    }
    if (action === 'ledger-publish') {
      const input = await inputFor(request, PublishLedgerEntry, 12_000);
      if (!input) return deny(400, 'Enter a party title and keep the recap to 1,500 characters.');
      const result = await room.publishLedgerEntry(input);
      if (result.status === 'missing') return deny(404, 'Ledger entry unavailable');
      if (result.status === 'conflict')
        return json(
          {
            error: 'Another DM tab published this entry. Review your version again.',
            entry: result.entry,
          },
          409,
        );
      return json(result.entry);
    }
    if (action === 'reveal') {
      const input = await inputFor(request, Reveal);
      if (!input) return deny(400, 'Invalid reveal');
      const result = await room.reveal(input);
      return result
        ? json(result)
        : deny(409, 'This draft is unavailable or the room has changed.');
    }
    if (action === 'apply') {
      const input = await inputFor(request, Apply);
      if (!input) return deny(400, 'Invalid draft');
      const result = await room.apply(input.id);
      return result
        ? json(result)
        : deny(409, 'This draft is unavailable or Pip’s appearance has changed.');
    }
    if (action !== 'jobs') return deny(404, 'Not found');
    const input = await inputFor(request, Start);
    if (!input) return deny(400, 'Enter a short description and a room name for a backdrop.');
    const job = await room.reserve(input);
    if (!job) return deny(409, 'The job ID already belongs to another draft');
    if (job.status === 'pending') {
      try {
        await env.GENERATE.create({ id: job.assetId, params: { id: job.id, teamId } });
      } catch {
        try {
          const instance = await env.GENERATE.get(job.assetId);
          if ((await instance.status()).status === 'unknown')
            return deny(503, 'Generation could not start. Retry this request.');
        } catch {
          return deny(503, 'Generation could not start. Retry this request.');
        }
      }
    }
    return json(job, 202);
  },
} satisfies ExportedHandler<Env>;
