import { Effect, Option } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReportToObservatory } from '../request-diagnostics/command';
import { Message as DiagnosticsMessage } from '../request-diagnostics/message';
import { CopySessionLink, CopyTest } from './command';
import { channelName } from './live';
import { sessionFrom } from './share';
import { lastStep } from './specimen';
import { checkoutExamples, checkoutMachine } from './specimens/checkout';

const clipboard = (writeText: (text: string) => Promise<void>) =>
  vi.spyOn(globalThis.navigator.clipboard, 'writeText').mockImplementation(writeText);

const session = { specimen: 'checkout', events: ['{"_tag":"AddedItem"}'], at: 1 };

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.history.replaceState(null, '', '/');
});

// These tests run each Command's Effect, catching one that stops writing to the clipboard,
// the address bar or the live channel, or that reports success when the browser refused.
describe('stateflow Commands', () => {
  it('copies a test to the clipboard and says so', async () => {
    const writeText = clipboard(() => Promise.resolve());

    const message = await Effect.runPromise(CopyTest({ text: 'it("works")' }).effect);

    expect(writeText).toHaveBeenCalledWith('it("works")');
    expect(message).toEqual({ _tag: 'CompletedCopy', what: 'test', copied: true });
  });

  it('says a test was not copied when the clipboard refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));

    const message = await Effect.runPromise(CopyTest({ text: 'it("works")' }).effect);

    expect(message).toEqual({ _tag: 'CompletedCopy', what: 'test', copied: false });
  });

  it('puts the session link in the address bar and on the clipboard', async () => {
    const writeText = clipboard(() => Promise.resolve());

    const message = await Effect.runPromise(CopySessionLink({ session }).effect);
    const link = globalThis.location.href;

    expect(Option.getOrNull(sessionFrom(link))).toEqual(session);
    expect(writeText).toHaveBeenCalledWith(link);
    expect(message).toEqual({ _tag: 'CompletedCopy', what: 'link', copied: true });
  });

  it('keeps the link in the address bar when the clipboard refuses', async () => {
    clipboard(() => Promise.reject(new Error('denied')));

    const message = await Effect.runPromise(CopySessionLink({ session }).effect);

    expect(Option.getOrNull(sessionFrom(globalThis.location.href))).toEqual(session);
    expect(message).toEqual({ _tag: 'CompletedCopy', what: 'link', copied: false });
  });

  it('reports a diagnostics message on the live channel', async () => {
    const listener = new BroadcastChannel(channelName);
    const received = new Promise<unknown>((resolve) => {
      listener.onmessage = ({ data }: MessageEvent<unknown>) => resolve(data);
    });

    const message = await Effect.runPromise(
      ReportToObservatory({ message: DiagnosticsMessage.ClickedReload() }).effect,
    );

    expect(message).toEqual({ _tag: 'CompletedReportToObservatory' });
    expect(await received).toEqual({
      specimen: 'request-diagnostics',
      event: '{"_tag":"ClickedReload"}',
    });
    listener.close();
  });

  it('charges the checkout specimen’s card and settles approved', async () => {
    const { card, checkout, goodAddress, added } = checkoutExamples;
    const result = lastStep(checkoutMachine, [added, checkout, goodAddress, card]);
    const [charge] = result._tag === 'Transitioned' ? result.commands : [];

    expect(charge?.name).toBe('ChargeCard');
    expect(await Effect.runPromise(charge?.effect ?? Effect.void)).toEqual({
      _tag: 'SettledCharge',
      approved: true,
    });
  });
});
