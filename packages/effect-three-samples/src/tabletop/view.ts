import { Lockstep } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Match, Option } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { sceneMount } from './environment';
import { Message } from './message';
import type { Model } from './model';
import { sceneFor } from './scene';
import type { Relay } from './wire';

type H = HtmlBuilder<Message>;

const button = (h: H, label: string, enabled: boolean, message: Message): Html =>
  h.button(
    [h.Class('e3-button'), h.Type('button'), h.Disabled(!enabled), h.OnClick(message)],
    [label],
  );

const others = (lockstep: Lockstep.Lockstep<unknown>): number =>
  Lockstep.membersAt(lockstep, lockstep.turn).length - 1;

const players = (count: number): string => `${count} other ${count === 1 ? 'player' : 'players'}`;

const withTabs = (count: number): string =>
  count === 0
    ? 'Playing alone. Open this page in another tab to play together.'
    : `Playing with ${players(count)}.`;

const overRelay = (count: number, url: string): string =>
  count === 0
    ? `Playing alone, through the relay at ${url}. Open this address elsewhere to play together.`
    : `Playing with ${players(count)}, through the relay at ${url}.`;

const overTabs = (model: Model): string =>
  Match.valueTags(model.session, {
    Offline: () => 'Starting…',
    Joining: () => 'Looking for other tabletop tabs…',
    Live: ({ lockstep }) => withTabs(others(lockstep)),
  });

const throughRelay = (model: Model, relay: Relay): string => {
  if (relay.link === 'Lost') return `Not connected to the relay at ${relay.url}: playing alone.`;
  if (relay.link === 'Connecting') return `Connecting to the relay at ${relay.url}…`;
  return Match.valueTags(model.session, {
    Offline: () => 'Starting…',
    Joining: () => `Looking for other players at ${relay.url}…`,
    Live: ({ lockstep }) => overRelay(others(lockstep), relay.url),
  });
};

const together = (model: Model): string => {
  if (model.away) return 'Stepped out while this page was hidden; back in when it is shown.';
  return Option.match(model.relay, {
    onNone: () => overTabs(model),
    onSome: (relay) => throughRelay(model, relay),
  });
};

/** Who this peer plays with, and a way back to the relay once it has lost it. */
const session = (model: Model, h: H): Html =>
  h.p(
    [h.Class('e3-note e3-together'), h.AriaLive('polite')],
    [
      together(model),
      ...(!model.away && Option.exists(model.relay, (relay) => relay.link === 'Lost')
        ? [' ', button(h, 'Reconnect', true, Message.ClickedReconnect())]
        : []),
    ],
  );

/** Where the world is, and whether the other peers' worlds agree with it. */
const agreement = (model: Model): string => {
  const where = Option.match(model.reached, {
    onNone: () => 'The world has not started.',
    onSome: ({ step, checksum }) => `Step ${step}, checksum ${checksum}.`,
  });
  const verdict = Option.match(model.diverged, {
    onNone: () =>
      model.agreed === 0
        ? 'No other world to compare with yet.'
        : `${model.agreed} ${model.agreed === 1 ? 'check' : 'checks'} agreed with the other worlds.`,
    onSome: (step) => `Out of step with another world since step ${step}.`,
  });
  return `${where} ${verdict}`;
};

const playing = (model: Model): boolean => model.session._tag === 'Live';

export const view = (model: Model, h: H): Document => ({
  title: 'Tabletop — effect-three',
  body: h.div(
    [h.Class('e3-sample')],
    [
      EffectThreeFoldkit.view(
        {
          scene: sceneFor(model),
          mount: sceneMount,
          className: 'e3-stage',
          onLifecycle: (lifecycle) => Message.ReceivedSceneLifecycle({ lifecycle }),
          onClick: ({ point }) => Message.ClickedTable({ point }),
          onPhysicsReached: ({ run, step, checksum }) =>
            Message.ReachedStep({ run, step, checksum }),
        },
        h,
      ),
      h.p(
        [h.Class('e3-readout'), h.AriaLive('polite')],
        [
          playing(model)
            ? `${model.balls.length} balls on the table. Click the table or the tower to throw one.`
            : 'Throws wait for a session.',
        ],
      ),
      session(model, h),
      h.p([h.Class('e3-note e3-agreement')], [agreement(model)]),
      h.div(
        [h.Class('e3-controls')],
        [button(h, 'Rebuild the tower', playing(model), Message.ClickedRebuild())],
      ),
    ],
  ),
});
