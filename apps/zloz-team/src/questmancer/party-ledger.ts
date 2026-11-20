import type { HtmlBuilder } from 'foldkit/html';

import { clientPaths } from './client-paths';
import type { PartyLedgerEntry } from './contracts';

export function partyEntryCard<Message>(
  h: HtmlBuilder<Message>,
  entry: PartyLedgerEntry,
  generatedArt: string,
) {
  return h.article(
    [h.Class('party-entry'), h.Key(String(entry.id))],
    [
      entry.room.style === 'plain'
        ? h.div([h.Class('plain-backdrop ledger-plain'), h.AriaHidden(true)], [])
        : h.img([
            h.Src(
              entry.room.style === 'original'
                ? clientPaths().baseArt + 'aurora-gate.jpg'
                : generatedArt,
            ),
            h.Alt('Backdrop for ' + entry.room.title),
          ]),
      h.div(
        [h.Class('party-entry-text')],
        [
          h.h3([], [entry.title]),
          h.p([h.Class('party-room')], [entry.room.title]),
          ...(entry.recap.trim() ? [h.p([h.Class('party-recap')], [entry.recap])] : []),
        ],
      ),
    ],
  );
}

export function partyLedgerView<Message>(
  h: HtmlBuilder<Message>,
  entries: readonly PartyLedgerEntry[] | null,
  refreshFailed: boolean,
) {
  return h.section(
    [
      h.Id('librarians-ledger'),
      h.Tabindex(-1),
      h.Class('sprite-panel ledger-panel'),
      h.AriaLabelledBy('party-ledger-heading'),
    ],
    [
      h.h2([h.Id('party-ledger-heading')], ['Party Ledger']),
      h.p(
        [h.Role('status'), h.Class('ledger-status')],
        [
          refreshFailed
            ? 'The Ledger could not refresh. Reconnecting…'
            : entries === null
              ? 'Loading entries…'
              : entries.length === 0
                ? 'The DM hasn’t published any entries yet.'
                : '',
        ],
      ),
      ...(entries ?? []).map((entry) =>
        partyEntryCard(h, entry, clientPaths().authoringUrl + 'party-art/' + entry.id),
      ),
    ],
  );
}
