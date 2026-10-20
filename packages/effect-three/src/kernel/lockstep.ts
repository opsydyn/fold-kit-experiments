/**
 * Lockstep, as data (roadmap, "Beyond parity" 2): peers that run the same `update` stay
 * in the same state by applying the same inputs in the same order. Time is cut into
 * turns; every member sends one packet for each turn (empty when it did nothing), and a
 * turn applies only once every member's packet for it has arrived, its inputs in peer
 * order. Any transport that delivers each packet to every peer will do: a
 * `BroadcastChannel` between tabs, a socket relay between machines.
 *
 * Membership changes in step too. The leader (the member whose id sorts first) admits
 * a newcomer with an entry in its own packet; when that turn applies, everywhere at
 * once, the newcomer becomes a member `lead + 1` turns later, and the leader sends it
 * the state as it is then (`welcomeDue`), from which it carries on. A member that leaves
 * says which turn it sent last (`leave`); one that goes quiet is dropped by the leader
 * from the turn everyone is waiting on, which no one can have applied.
 *
 * Pure functions over a value, like the rest of the kernel: an app keeps the `Lockstep`
 * in its Model, sends what `send` gives it, passes what arrives to `receive`, and
 * applies what `advance` returns. Use it as a namespace: `Lockstep.make(self)`.
 *
 * @module
 */

/** What a turn carries: an app's input, or the leader admitting a newcomer. */
export type Entry<I> =
  | { readonly _tag: 'Input'; readonly input: I }
  | { readonly _tag: 'Admit'; readonly peer: string };

/** One member's packet for one turn. */
export type Packet<I> = {
  readonly peer: string;
  readonly turn: number;
  readonly entries: ReadonlyArray<Entry<I>>;
};

/** A member: the first turn it sends for, and the turn it stopped before, once it has. */
export type Member = {
  readonly peer: string;
  readonly from: number;
  readonly until: number | null;
};

export type Lockstep<I> = {
  readonly self: string;
  readonly members: ReadonlyArray<Member>;
  /** The next turn to apply. */
  readonly turn: number;
  /** The next turn this peer sends for. */
  readonly sent: number;
  /** How many turns ahead of the applied one a peer may send: inputs wait this long. */
  readonly lead: number;
  /** Entries waiting for this peer's next packet. */
  readonly pending: ReadonlyArray<Entry<I>>;
  /** Packets for turns not yet applied, this peer's own among them. */
  readonly received: ReadonlyArray<Packet<I>>;
};

/** An input applied: the turn, and the peer it came from. */
export type Applied<I> = { readonly turn: number; readonly peer: string; readonly input: I };

const sortedPeers = (members: ReadonlyArray<Member>): ReadonlyArray<Member> =>
  members.toSorted((a, b) => (a.peer < b.peer ? -1 : a.peer > b.peer ? 1 : 0));

const memberAt = (member: Member, turn: number): boolean =>
  member.from <= turn && (member.until === null || turn < member.until);

/** The members a turn waits for, in the order their inputs apply. */
export const membersAt = <I>(state: Lockstep<I>, turn: number): ReadonlyArray<string> =>
  sortedPeers(state.members.filter((member) => memberAt(member, turn))).map(
    (member) => member.peer,
  );

/** The member who admits and drops others at `turn`: the one whose id sorts first. */
export const leaderAt = <I>(state: Lockstep<I>, turn: number): string | undefined =>
  membersAt(state, turn)[0];

/** A session of one: this peer alone, from turn 0. */
export const make = <I>(self: string, lead = 2): Lockstep<I> => ({
  self,
  members: [{ peer: self, from: 0, until: null }],
  turn: 0,
  sent: 0,
  lead,
  pending: [],
  received: [],
});

/**
 * A newcomer's session, from the leader's welcome: the members and the turn it starts
 * at, with whatever packets it heard while it waited.
 */
export const join = <I>(
  self: string,
  welcome: {
    readonly turn: number;
    readonly members: ReadonlyArray<Member>;
    readonly lead: number;
  },
  heard: ReadonlyArray<Packet<I>> = [],
): Lockstep<I> => ({
  self,
  members: welcome.members,
  turn: welcome.turn,
  sent: welcome.turn,
  lead: welcome.lead,
  pending: [],
  received: heard.filter((packet) => packet.turn >= welcome.turn),
});

/** `input` waits for this peer's next packet. */
export const submit = <I>(state: Lockstep<I>, input: I): Lockstep<I> => ({
  ...state,
  pending: [...state.pending, { _tag: 'Input', input }],
});

const known = <I>(state: Lockstep<I>, peer: string): boolean =>
  state.members.some((member) => member.peer === peer && member.until === null) ||
  state.pending.some((entry) => entry._tag === 'Admit' && entry.peer === peer);

/** The leader asks for `peer` to be admitted; anyone else, or a known peer, changes nothing. */
export const admit = <I>(state: Lockstep<I>, peer: string): Lockstep<I> =>
  leaderAt(state, state.sent) !== state.self || known(state, peer)
    ? state
    : { ...state, pending: [...state.pending, { _tag: 'Admit', peer }] };

const hasPacket = <I>(state: Lockstep<I>, peer: string, turn: number): boolean =>
  state.received.some((packet) => packet.peer === peer && packet.turn === turn);

/**
 * A packet arriving: kept until its turn applies. Ones for turns already applied, from
 * peers not members then, and second copies are dropped.
 */
export const receive = <I>(state: Lockstep<I>, packet: Packet<I>): Lockstep<I> => {
  if (packet.turn < state.turn || hasPacket(state, packet.peer, packet.turn)) return state;
  const member = state.members.find((each) => each.peer === packet.peer);
  if (member !== undefined && !memberAt(member, packet.turn)) return state;
  return { ...state, received: [...state.received, packet] };
};

/**
 * This peer's packet for its next turn, with what is pending, when it is a member then
 * and not more than `lead` turns ahead; it keeps its own copy.
 */
export const send = <I>(
  state: Lockstep<I>,
): { readonly state: Lockstep<I>; readonly packet: Packet<I> | undefined } => {
  const member = state.members.find((each) => each.peer === state.self);
  const ahead = state.sent >= state.turn + state.lead;
  if (member === undefined || !memberAt(member, state.sent) || ahead) {
    return { state, packet: undefined };
  }
  const packet: Packet<I> = { peer: state.self, turn: state.sent, entries: state.pending };
  return {
    state: { ...state, sent: state.sent + 1, pending: [], received: [...state.received, packet] },
    packet,
  };
};

/** Peers whose packet for the next turn has not arrived: what the session waits on. */
export const waitingOn = <I>(state: Lockstep<I>): ReadonlyArray<string> =>
  membersAt(state, state.turn).filter((peer) => !hasPacket(state, peer, state.turn));

/** `peer`'s packet for `turn`, as a list of none or one. */
const packetsOf = <I>(state: Lockstep<I>, peer: string, turn: number): ReadonlyArray<Packet<I>> =>
  state.received.filter((packet) => packet.peer === peer && packet.turn === turn);

/** One turn applied, its admissions made members `lead + 1` turns on. */
const applyTurn = <I>(
  state: Lockstep<I>,
): { state: Lockstep<I>; applied: ReadonlyArray<Applied<I>> } => {
  const turn = state.turn;
  const packets = membersAt(state, turn).flatMap((peer) => packetsOf(state, peer, turn));
  const entries = packets.flatMap((packet) =>
    packet.entries.map((entry) => ({ peer: packet.peer, entry })),
  );
  const admitted = entries.flatMap(({ entry }) =>
    entry._tag === 'Admit' && !state.members.some((member) => member.peer === entry.peer)
      ? [{ peer: entry.peer, from: turn + state.lead + 1, until: null }]
      : [],
  );
  const applied = entries.flatMap(({ peer, entry }) =>
    entry._tag === 'Input' ? [{ turn, peer, input: entry.input }] : [],
  );
  return {
    state: {
      ...state,
      turn: turn + 1,
      members: [...state.members, ...admitted],
      received: state.received.filter((packet) => packet.turn > turn),
    },
    applied,
  };
};

/**
 * Every turn whose packets have all arrived, applied in order: the new state, and the
 * inputs to apply to the app, oldest first and in peer order within a turn.
 */
export const advance = <I>(
  state: Lockstep<I>,
): { readonly state: Lockstep<I>; readonly applied: ReadonlyArray<Applied<I>> } => {
  let current = state;
  const applied: Array<Applied<I>> = [];
  // A turn with no members waits forever rather than passing unheard.
  while (membersAt(current, current.turn).length > 0 && waitingOn(current).length === 0) {
    const next = applyTurn(current);
    current = next.state;
    applied.push(...next.applied);
  }
  return { state: current, applied };
};

/**
 * Newcomers this peer, as leader, should welcome now: those who become members at the
 * turn about to apply, once every turn before it has (the state is then theirs to start
 * from). Each is due once: at the moment `before` (the previous turn) is passed.
 */
export const welcomeDue = <I>(before: number, state: Lockstep<I>): ReadonlyArray<string> =>
  state.members
    .filter((member) => member.from > before && member.from <= state.turn)
    // The leader of the turn before the newcomer counts: never the newcomer itself, whose
    // id may sort first.
    .filter((member) => leaderAt(state, member.from - 1) === state.self)
    .map((member) => member.peer);

/** This peer leaving: the turn it sent last, for the others to stop waiting after. */
export const leave = <I>(state: Lockstep<I>): number => state.sent - 1;

/** `peer` stops being a member from `until`; its packets from then are dropped. */
export const remove = <I>(state: Lockstep<I>, peer: string, until: number): Lockstep<I> => ({
  ...state,
  members: state.members.map((member) =>
    member.peer === peer && (member.until === null || until < member.until)
      ? { ...member, until }
      : member,
  ),
  received: state.received.filter((packet) => packet.peer !== peer || packet.turn < until),
});
