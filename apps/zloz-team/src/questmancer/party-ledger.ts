import type { Html } from '@effect/ui/html';

import { baseArt } from './client-paths';
import type { PartyLedgerEntry } from './contracts';

export function partyEntryCard<Message>(
  h: Html.H<Message>,
  entry: PartyLedgerEntry,
  generatedArt: string,
) {
  return h.article
    .class('party-entry')
    .key(String(entry.id))
    .children(
      entry.room.style === 'plain'
        ? h.div.class('plain-backdrop ledger-plain').attr('aria-hidden', 'true').children()
        : h.img
            .attr(
              'src',
              entry.room.style === 'original' ? baseArt + 'aurora-gate.jpg' : generatedArt,
            )
            .attr('alt', 'Backdrop for ' + entry.room.title),
      h.div
        .class('party-entry-text')
        .children(
          h.h3.children(entry.title),
          h.p.class('party-room').children(entry.room.title),
          ...(entry.recap.trim() ? [h.p.class('party-recap').children(entry.recap)] : []),
        ),
    );
}

export function partyLedgerView<Message>(
  h: Html.H<Message>,
  entries: readonly PartyLedgerEntry[] | null,
  refreshFailed: boolean,
  authoringUrl: string,
) {
  return h.section
    .id('librarians-ledger')
    .attr('tabindex', String(-1))
    .class('sprite-panel ledger-panel')
    .attr('aria-labelledby', 'party-ledger-heading')
    .children(
      h.h2.id('party-ledger-heading').children('Party Ledger'),
      h.p
        .attr('role', 'status')
        .class('ledger-status')
        .children(
          refreshFailed
            ? 'The Ledger could not refresh. Reconnecting…'
            : entries === null
              ? 'Loading entries…'
              : entries.length === 0
                ? 'The DM hasn’t published any entries yet.'
                : '',
        ),
      ...(entries ?? []).map((entry) =>
        partyEntryCard(h, entry, authoringUrl + 'party-art/' + entry.id),
      ),
    );
}
