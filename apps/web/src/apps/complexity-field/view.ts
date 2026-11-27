import type { Html } from '@effect/ui/html';
import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';
import { dataTable } from '@opsydyn/foldkit-viz/effect-ui/cartesian';
import { orbitChart } from '@opsydyn/foldkit-viz/effect-ui/orbit';
import { radialGradient } from '@opsydyn/foldkit-viz/effect-ui/paint';

import { Message } from './message';
import { riskTier, summarise } from './model';
import type { Integration, Model, Module, RiskTier, Subdomain } from './model';

import * as styles from './complexity-field.css';

const SIZE = 300;
const { palette } = styles;

const subdomainColour = {
  core: palette.critical,
  supporting: palette.ready,
  generic: palette.tertiary,
} satisfies Record<Subdomain, string>;
const integrationColour = {
  intrusive: palette.critical,
  contract: palette.primary,
  functional: palette.ready,
} satisfies Record<Integration, string>;
const tierColour = {
  high: palette.critical,
  medium: palette.caution,
  low: palette.ready,
} satisfies Record<RiskTier, string>;
const isIntegration = (key: string): key is Integration => key in integrationColour;

const fixed = (value: number): string => value.toFixed(1);

/** The module the readout describes: the inspected one, else the selected one. */
const focused = (model: Model): Module | undefined => {
  const key = model.inspected ?? model.selected;
  return key === null ? undefined : model.modules.find(({ id }) => id === key);
};

const chart = (model: Model, h: Html.H<Message>) => {
  const summary = summarise(model.modules);
  // The ball of mud grows with average risk, as in c4-board's Complexity Field.
  const coreScale = Math.min(1, 0.55 + summary.averageRisk / 20);
  const geometry = orbitGeometry(
    model.modules,
    { key: ({ id }) => id, value: ({ risk }) => risk, halo: ({ integration }) => integration },
    { size: SIZE, nodeRadius: { min: 4, max: 9 }, valueDomain: [1, 10], coreScale },
  );
  const tier = riskTier(summary.highestRisk?.risk ?? 0);
  const gradientId = `gradient-${h.id('core')}`;
  return orbitChart(h, {
    geometry,
    title: 'Complexity field',
    description: `${model.modules.length} modules around a core sized by average risk ${fixed(summary.averageRisk)}. Each module's area is its systemic risk.`,
    defs: [
      radialGradient(h, {
        id: gradientId,
        stops: [
          { offset: 0, colour: tierColour[tier], opacity: 0.85 },
          { offset: 1, colour: palette.surface, opacity: 0.1 },
        ],
      }),
    ],
    coreFill: `url(#${gradientId})`,
    coreStroke: 'var(--field-border, #2a3a34)',
    pulse: {
      radius: Math.min(
        geometry.core.radius + 4 + summary.maxRisk * 0.6,
        geometry.halo.innerRadius - 2,
      ),
      colour: tierColour[tier],
    },
    centre: [
      { text: `MOD ${fixed(summary.averageModularity)}`, colour: palette.text, size: 15 },
      { text: `BAL ${fixed(summary.averageBalance)}`, colour: palette.ready, size: 12 },
      { text: `RISK ${fixed(summary.averageRisk)}`, colour: palette.critical, size: 12 },
    ],
    haloColour: (key) => (isIntegration(key) ? integrationColour[key] : palette.tertiary),
    nodeStyle: ({ datum }) => ({
      fill: subdomainColour[datum.subdomain],
      stroke: tierColour[riskTier(datum.risk)],
    }),
    labelFor: (module) =>
      `${module.label}: ${module.subdomain}, ${module.integration}, risk ${fixed(module.risk)}`,
    activeKey: model.inspected,
    selectedKey: model.selected,
    onInspect: (key) => Message.InspectedModule({ key }),
    onSelect: (key) => Message.SelectedModule({ key }),
  });
};

const readout = (model: Model, h: Html.H<Message>) => {
  const module = focused(model);
  return h.div
    .attrs({ class: styles.readout, 'aria-live': 'polite' })
    .children(
      module === undefined
        ? [h.span.attr('class', styles.standby).children('[████] ENGINEERING SYSTEM STANDBY')]
        : [
            h.strong.children(module.label),
            h.div.children(
              [
                module.subdomain,
                module.integration,
                `balance ${fixed(module.balance)}`,
                `risk ${fixed(module.risk)}`,
              ]
                .join(' • ')
                .toUpperCase(),
            ),
          ],
    );
};

const tile = (h: Html.H<Message>, label: string, value: string) =>
  h.div
    .attr('class', styles.tile)
    .children(
      h.dt.attr('class', styles.tileLabel).children(label),
      h.dd.attr('class', styles.tileValue).children(value),
    );

const legend = <Key extends string>(
  h: Html.H<Message>,
  label: string,
  colours: Record<Key, string>,
) =>
  h.ul
    .attrs({ class: styles.legend, 'aria-label': label })
    .children(
      h.li.children(`${label}:`),
      ...Object.entries<string>(colours).map(([key, colour]) =>
        h.li.attr('style', `color:${colour}`).children(`● ${key}`),
      ),
    );

export const view = (h: Html.H<Message>, model: Model) => {
  const summary = summarise(model.modules);
  const nexus = summary.highestRisk;
  return h.section.attrs({ class: styles.card, 'aria-label': 'Complexity field' }).children(
    h.h2.attr('class', styles.title).children('Complexity field'),
    h.p
      .attr('class', styles.meta)
      .children(
        `High risk nexus: ${nexus === undefined ? 'stable' : `${nexus.label} · ${fixed(nexus.risk)}`}`,
      ),
    h.div
      .attr('class', styles.canvas)
      .children(
        readout(model, h),
        chart(model, h),
        ...(summary.averageRisk >= model.threshold
          ? [
              h.p
                .attrs({ class: styles.warning, role: 'alert' })
                .children(
                  `[CRITICAL] BIG BALL OF MUD DETECTED (THRESHOLD ${fixed(model.threshold)})`,
                ),
            ]
          : []),
      ),
    h.dl
      .attr('class', styles.tiles)
      .children(
        tile(h, 'Modules', String(model.modules.length)),
        tile(h, 'Avg risk', fixed(summary.averageRisk)),
        tile(h, 'Balance', fixed(summary.averageBalance)),
        tile(h, 'Core', String(summary.counts.core)),
        tile(h, 'Supporting', String(summary.counts.supporting)),
        tile(h, 'Generic', String(summary.counts.generic)),
      ),
    legend(h, 'Subdomain', subdomainColour),
    legend(h, 'Integration', integrationColour),
    h.details.attr('class', styles.tableToggle).children(
      h.summary.children('Module table'),
      dataTable(h, {
        caption: 'Modules by systemic risk',
        headers: ['Module', 'Subdomain', 'Integration', 'Balance', 'Risk'],
        rows: [...model.modules]
          .sort((a, b) => b.risk - a.risk)
          .map((module) => [
            module.label,
            module.subdomain,
            module.integration,
            fixed(module.balance),
            fixed(module.risk),
          ]),
      }),
    ),
  );
};
