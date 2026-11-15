import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';
import { dataTable } from '@opsydyn/foldkit-viz/foldkit/cartesian';
import { orbitChart } from '@opsydyn/foldkit-viz/foldkit/orbit';
import { radialGradient } from '@opsydyn/foldkit-viz/foldkit/paint';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { Message } from './message';
import { riskTier, summarise } from './model';
import type { Integration, Model, Module, RiskTier, Subdomain } from './model';

import * as styles from './complexity-field.css';

const SIZE = 300;
const GRADIENT_ID = 'complexity-field-core';
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

const chart = (model: Model, h: HtmlBuilder<Message>): Html => {
  const summary = summarise(model.modules);
  // The ball of mud grows with average risk, as in c4-board's Complexity Field.
  const coreScale = Math.min(1, 0.55 + summary.averageRisk / 20);
  const geometry = orbitGeometry(
    model.modules,
    { key: ({ id }) => id, value: ({ risk }) => risk, halo: ({ integration }) => integration },
    { size: SIZE, nodeRadius: { min: 4, max: 9 }, valueDomain: [1, 10], coreScale },
  );
  const tier = riskTier(summary.highestRisk?.risk ?? 0);
  return orbitChart(h, {
    geometry,
    title: 'Complexity field',
    description: `${model.modules.length} modules around a core sized by average risk ${fixed(summary.averageRisk)}. Each module's area is its systemic risk.`,
    defs: [
      radialGradient(h, {
        id: GRADIENT_ID,
        stops: [
          { offset: 0, colour: tierColour[tier], opacity: 0.85 },
          { offset: 1, colour: palette.surface, opacity: 0.1 },
        ],
      }),
    ],
    coreFill: `url(#${GRADIENT_ID})`,
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

const readout = (model: Model, h: HtmlBuilder<Message>): Html => {
  const module = focused(model);
  return h.div(
    [h.Class(styles.readout), h.AriaLive('polite')],
    module === undefined
      ? [h.span([h.Class(styles.standby)], ['[████] ENGINEERING SYSTEM STANDBY'])]
      : [
          h.strong([], [module.label]),
          h.div(
            [],
            [
              [
                module.subdomain,
                module.integration,
                `balance ${fixed(module.balance)}`,
                `risk ${fixed(module.risk)}`,
              ]
                .join(' • ')
                .toUpperCase(),
            ],
          ),
        ],
  );
};

const tile = (h: HtmlBuilder<Message>, label: string, value: string): Html =>
  h.div(
    [h.Class(styles.tile)],
    [h.dt([h.Class(styles.tileLabel)], [label]), h.dd([h.Class(styles.tileValue)], [value])],
  );

const legend = <Key extends string>(
  h: HtmlBuilder<Message>,
  label: string,
  colours: Record<Key, string>,
): Html =>
  h.ul(
    [h.Class(styles.legend), h.AriaLabel(label)],
    [
      h.li([], [`${label}:`]),
      ...Object.entries<string>(colours).map(([key, colour]) =>
        h.li([h.Style({ color: colour })], [`● ${key}`]),
      ),
    ],
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const summary = summarise(model.modules);
  const nexus = summary.highestRisk;
  return {
    title: 'Complexity Field — foldkit-viz',
    body: h.section(
      [h.Class(styles.card), h.AriaLabel('Complexity field')],
      [
        h.h2([h.Class(styles.title)], ['Complexity field']),
        h.p(
          [h.Class(styles.meta)],
          [
            `High risk nexus: ${nexus === undefined ? 'stable' : `${nexus.label} · ${fixed(nexus.risk)}`}`,
          ],
        ),
        h.div(
          [h.Class(styles.canvas)],
          [
            readout(model, h),
            chart(model, h),
            ...(summary.averageRisk >= model.threshold
              ? [
                  h.p(
                    [h.Class(styles.warning), h.Role('alert')],
                    [`[CRITICAL] BIG BALL OF MUD DETECTED (THRESHOLD ${fixed(model.threshold)})`],
                  ),
                ]
              : []),
          ],
        ),
        h.dl(
          [h.Class(styles.tiles)],
          [
            tile(h, 'Modules', String(model.modules.length)),
            tile(h, 'Avg risk', fixed(summary.averageRisk)),
            tile(h, 'Balance', fixed(summary.averageBalance)),
            tile(h, 'Core', String(summary.counts.core)),
            tile(h, 'Supporting', String(summary.counts.supporting)),
            tile(h, 'Generic', String(summary.counts.generic)),
          ],
        ),
        legend(h, 'Subdomain', subdomainColour),
        legend(h, 'Integration', integrationColour),
        h.details(
          [h.Class(styles.tableToggle)],
          [
            h.summary([], ['Module table']),
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
          ],
        ),
      ],
    ),
  };
};
