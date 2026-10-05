import { expect, it } from 'bun:test';

import { Message as Bars } from '../src/examples/bars/message';
import { init as initBars } from '../src/examples/bars/model';
import { update as updateBars } from '../src/examples/bars/update';
import { words } from '../src/examples/wordcloud/data';
import { Message as Cloud } from '../src/examples/wordcloud/message';
import { init as initCloud } from '../src/examples/wordcloud/model';
import { update as updateCloud } from '../src/examples/wordcloud/update';
import { barData } from '../src/lib/gallery-charts';
it('bar controls change grouping/orientation without replacing input data', () => {
  const initial = initBars({ data: barData }).model;
  const stacked = updateBars(initial, Bars.SelectedMode({ mode: 'stacked' })).model;
  const horizontal = updateBars(
    stacked,
    Bars.SelectedOrientation({ orientation: 'horizontal' }),
  ).model;
  expect(horizontal.mode).toBe('stacked');
  expect(horizontal.orientation).toBe('horizontal');
  expect(horizontal.data).toEqual(barData);
  expect(updateBars(horizontal, Bars.ClickedReset()).model.mode).toBe('grouped');
});
it('cloud layout controls retain measurements; font controls request a new revision', () => {
  const initial = initCloud({ words });
  expect(initial.commands).toHaveLength(1);
  const rotated = updateCloud(initial.model, Cloud.SelectedRotation({ rotate: true }));
  expect(rotated.model.settings.rotate).toBe(true);
  expect(rotated.model.revision).toBe(1);
  const changed = updateCloud(rotated.model, Cloud.SelectedFont({ font: 'monospace' }));
  expect(changed.model.revision).toBe(2);
  expect(changed.commands).toHaveLength(1);
  const stale = updateCloud(
    changed.model,
    Cloud.SucceededMeasurement({ revision: 1, measurements: [] }),
  );
  expect(stale.model).toBe(changed.model);
  expect(
    updateCloud(changed.model, Cloud.FailedMeasurement({ revision: 1, error: 'stale' })).model,
  ).toBe(changed.model);
  const current = updateCloud(
    changed.model,
    Cloud.SucceededMeasurement({ revision: 2, measurements: [] }),
  );
  expect(current.model.measurement._tag).toBe('Ready');
});
it('invalid numeric controls leave settings intact and width updates are finite', () => {
  const initial = initCloud({ words }).model;
  expect(updateCloud(initial, Cloud.ChangedPadding({ value: 'NaN' })).model).toBe(initial);
  expect(updateCloud(initial, Cloud.ChangedSize({ value: '999' })).model).toBe(initial);
  expect(updateCloud(initial, Cloud.RecordedWidth({ width: 0 })).model).toBe(initial);
});
