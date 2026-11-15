import { ZlozError, type ZlozSnapshot } from '@opsydyn/foldkit-zloz';

import { parseReviewPacket, type ZlozReviewPacketParseOptions } from './parse-review-packet';
import type { ZlozReviewPacket } from './review-packet';
export type ZlozReviewReaderSide = 'baseline' | 'selected';
export type ZlozReviewReaderState = Readonly<{
  scope: string;
  run: number;
  pending: Readonly<{ run: number; name: string }> | null;
  review: Readonly<{
    id: number;
    name: string;
    packet: ZlozReviewPacket;
    side: ZlozReviewReaderSide;
  }> | null;
  notice: string;
}>;
export type ZlozReviewReaderOptions = Readonly<{
  blockedReason?: string | null;
  selectionReason?: string | null;
  maxBytes?: number;
  parseOptions?: ZlozReviewPacketParseOptions;
}>;
export type ZlozReviewReaderRequest = Readonly<{ scope: string }> &
  (
    | Readonly<{ type: 'ReadRequested'; file: Readonly<{ name: string; byteLength: number }> }>
    | Readonly<{ type: 'ReadSucceeded'; run: number; text: string }>
    | Readonly<{ type: 'ReadFailed'; run: number }>
    | Readonly<{ type: 'ReadCancelled'; run: number }>
    | Readonly<{ type: 'SideSelected'; reviewId: number; side: ZlozReviewReaderSide }>
    | Readonly<{ type: 'ReviewClosed'; reviewId: number }>
  );
export type ZlozReviewReaderUpdate = Readonly<{
  state: ZlozReviewReaderState;
  read: Readonly<{ scope: string; run: number; maxBytes: number }> | null;
}>;
export function createReviewReader(scope: string): ZlozReviewReaderState {
  if (!scope.trim()) throw new ZlozError('invalid-edit', 'Review reader needs a nonblank scope.');
  return { scope, run: 0, pending: null, review: null, notice: '' };
}
export function reviewReaderForScope(
  state: ZlozReviewReaderState,
  scope: string,
): ZlozReviewReaderState {
  return state.scope === scope ? state : createReviewReader(scope);
}
export function resolveReviewReader(
  state: ZlozReviewReaderState,
  options: ZlozReviewReaderOptions = {},
) {
  const sideReason =
    (options.selectionReason === undefined || options.selectionReason === null
      ? null
      : options.selectionReason.trim() || 'Side selection is protected.') ??
    (state.pending ? 'Finish or cancel the file read before changing sides.' : null);
  const snapshot: ZlozSnapshot | null = state.review
    ? state.review.packet[state.review.side].snapshot
    : null;
  return {
    state,
    snapshot,
    openReason:
      options.blockedReason === undefined || options.blockedReason === null
        ? null
        : options.blockedReason.trim() || 'Packet opening is protected.',
    sideReason,
    notice: state.notice,
  };
}
/** Pure request/live-policy boundary. Last good review survives failed, cancelled or stale reads. */
export function updateReviewReader(
  state: ZlozReviewReaderState,
  request: ZlozReviewReaderRequest,
  options: ZlozReviewReaderOptions = {},
): ZlozReviewReaderUpdate {
  const unchanged = (notice = state.notice): ZlozReviewReaderUpdate => ({
    state: notice === state.notice ? state : { ...state, notice },
    read: null,
  });
  if (request.scope !== state.scope) return unchanged();
  const blockedReason = resolveReviewReader(state, options).openReason;
  if (request.type === 'ReadRequested') {
    if (blockedReason !== null) return unchanged(blockedReason);
    const maxBytes = options.maxBytes ?? 1048576;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16000000)
      throw new ZlozError(
        'invalid-edit',
        'Review reader maxBytes must be an integer from 1 to 16000000.',
      );
    if (
      !request.file.name.trim() ||
      request.file.name.length > 256 ||
      !Number.isSafeInteger(request.file.byteLength) ||
      request.file.byteLength < 0 ||
      request.file.byteLength > maxBytes
    )
      return unchanged(
        `Choose one packet file of at most ${maxBytes} bytes. Previous review preserved.`,
      );
    if (!Number.isSafeInteger(state.run) || state.run < 0 || state.run === Number.MAX_SAFE_INTEGER)
      throw new ZlozError('invalid-edit', 'Review reader request counter exhausted.');
    const run = state.run + 1;
    return {
      state: {
        ...state,
        run,
        pending: { run, name: request.file.name },
        notice: 'Opening packet for read-only review…',
      },
      read: { scope: state.scope, run, maxBytes },
    };
  }
  if (request.type === 'ReviewClosed')
    return state.review?.id === request.reviewId
      ? {
          state: {
            ...state,
            review: null,
            pending: null,
            notice: 'Review closed. Working model preserved.',
          },
          read: null,
        }
      : unchanged();
  if (request.type === 'SideSelected') {
    if (request.side !== 'baseline' && request.side !== 'selected')
      return unchanged('Choose baseline or selected.');
    if (state.review?.id !== request.reviewId) return unchanged();
    const reason = resolveReviewReader(state, options).sideReason;
    if (reason) return unchanged(reason);
    return {
      state: {
        ...state,
        review: { ...state.review, side: request.side },
        notice: `Read-only ${request.side} snapshot. Working model preserved.`,
      },
      read: null,
    };
  }
  if (state.pending?.run !== request.run) return unchanged();
  if (request.type === 'ReadCancelled')
    return {
      state: { ...state, pending: null, notice: 'Read cancelled. Previous review preserved.' },
      read: null,
    };
  if (request.type === 'ReadFailed')
    return {
      state: {
        ...state,
        pending: null,
        notice:
          'Could not read UTF-8 packet file within its byte limit. Previous review preserved.',
      },
      read: null,
    };
  if (blockedReason !== null)
    return {
      state: {
        ...state,
        pending: null,
        notice: `${blockedReason} Previous review preserved.`,
      },
      read: null,
    };
  const result = parseReviewPacket(request.text, options.parseOptions);
  if (result.status === 'rejected')
    return {
      state: {
        ...state,
        pending: null,
        notice: `${result.code}${result.path ? ` at ${result.path}` : ''}: ${result.reason} Previous review preserved.`,
      },
      read: null,
    };
  return {
    state: {
      ...state,
      pending: null,
      review: { id: request.run, name: state.pending.name, packet: result.value, side: 'selected' },
      notice: 'Packet opened read-only. Working model and Undo preserved.',
    },
    read: null,
  };
}
