# Changelog

All notable changes to `@opsydyn/foldkit-viz` are documented here.

## [1.0.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.19.1...foldkit-viz-v1.0.0) (2026-11-28)


### ⚠ BREAKING CHANGES

* **viz:** replace legacy rendering adapters with Effect UI
* **viz:** move chart keyboard handlers to Effect UI

### Features

* **foldkit-viz:** add Effect UI Cartesian rendering ([d02c010](https://github.com/opsydyn/fold-kit-experiments/commit/d02c010de6e3e9f554a443fa4e279120451eae39))
* **foldkit-viz:** render canvas plots in Effect UI ([2a4c708](https://github.com/opsydyn/fold-kit-experiments/commit/2a4c708d23693c59ed797dd47f7e87a517aed3b0))
* **foldkit-viz:** render compiled plots in Effect UI ([3ad83bc](https://github.com/opsydyn/fold-kit-experiments/commit/3ad83bc4a40fdaef8bed4e627afe79dc06aa6848))
* **viz:** add Effect UI Cartesian series renderers ([09ba0d2](https://github.com/opsydyn/fold-kit-experiments/commit/09ba0d235fa527bd7f731cf4e24184495fc9e98b))
* **viz:** add Effect UI orbit and SVG paint renderers ([598f474](https://github.com/opsydyn/fold-kit-experiments/commit/598f474116a2a3ca6b75ef97f175ad6176f38b7b))
* **viz:** move chart keyboard handlers to Effect UI ([5c4c90d](https://github.com/opsydyn/fold-kit-experiments/commit/5c4c90dbb7dcf80cf5fe9743d81820cebd819263))
* **viz:** replace legacy rendering adapters with Effect UI ([1488a62](https://github.com/opsydyn/fold-kit-experiments/commit/1488a621e6ec0ea109ec7d70a839172eeb81b270))

## [0.19.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.19.0...foldkit-viz-v0.19.1) (2026-11-23)

### Bug Fixes

- ship the widened FoldKit 0.171 peer ranges, and record the upgrade ([#189](https://github.com/opsydyn/fold-kit-experiments/issues/189)) ([44a06de](https://github.com/opsydyn/fold-kit-experiments/commit/44a06dea64fcaa1ead7c87460f352ab75fc1aa86))

## [0.19.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.18.0...foldkit-viz-v0.19.0) (2026-11-16)

### Features

- **foldkit-viz:** export, Jupyter, GPU points, DuckDB pushdown and 3D charts ([#146](https://github.com/opsydyn/fold-kit-experiments/issues/146)) ([f37d448](https://github.com/opsydyn/fold-kit-experiments/commit/f37d4489bacbe41e122b00cd43d4bf53f2068df5))

## [0.18.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.17.0...foldkit-viz-v0.18.0) (2026-11-15)

### Features

- **foldkit-viz:** 2D and hexagonal binning, and a cell geometry for heatmaps ([8142af9](https://github.com/opsydyn/fold-kit-experiments/commit/8142af9117605634cbb62049a523277e73d1fc16))
- **foldkit-viz:** accessible summaries and data tables for plots ([a6f8dc0](https://github.com/opsydyn/fold-kit-experiments/commit/a6f8dc08dcbcf879ce02d0e425130b9bd1da11fc))
- **foldkit-viz:** axis: false hides an axis's labels and grid ([a115a06](https://github.com/opsydyn/fold-kit-experiments/commit/a115a06bd181ca64b6ffcbc3fdec8d395e4792b1))
- **foldkit-viz:** box, violin and link marks, interval bars and colour ranges ([97c5673](https://github.com/opsydyn/fold-kit-experiments/commit/97c56732255816a2a55f9a1ca0a281351ae13291))
- **foldkit-viz:** canvas/plot paints compiled plots on a 2D canvas ([ebf59ab](https://github.com/opsydyn/fold-kit-experiments/commit/ebf59abcec57fab8affc82e1cad3a89cd0b3086d))
- **foldkit-viz:** compilePlot, a declarative grammar of marks ([11a2275](https://github.com/opsydyn/fold-kit-experiments/commit/11a2275073891c83742746f52cdb402ca61058e7))
- **foldkit-viz:** dense dot marks compile a million rows to packed arrays ([2c5e76d](https://github.com/opsydyn/fold-kit-experiments/commit/2c5e76d9e6c5a220bd6c61dd9cafabdb68492bb0))
- **foldkit-viz:** density mark, as curves or contours ([1ad307b](https://github.com/opsydyn/fold-kit-experiments/commit/1ad307b3d31731b76d5fe4a91fa332e61aaf20a1))
- **foldkit-viz:** hover, highlights and overlays for compiled plots ([e3613a9](https://github.com/opsydyn/fold-kit-experiments/commit/e3613a91cdf83c8e2bbada69449d417af0f73d9a))
- **foldkit-viz:** keyboard and focus contracts for charts ([bb402bc](https://github.com/opsydyn/fold-kit-experiments/commit/bb402bc820efa06c9bebe518ab05d5edb31d81a7))
- **foldkit-viz:** log, symlog, power and UTC time axes in the Cartesian layer ([0091691](https://github.com/opsydyn/fold-kit-experiments/commit/009169184b62a8502a33a392e302dfc4852f2c7c))
- **foldkit-viz:** LTTB and M4 downsampling for long series ([51dd268](https://github.com/opsydyn/fold-kit-experiments/commit/51dd268c9cb54484f4ee2c008d0dd490f63d5bb8))
- **foldkit-viz:** name colour schemes in the spec type and schema ([dc11a06](https://github.com/opsydyn/fold-kit-experiments/commit/dc11a0698f7fe0b2afbb116d89678b80a4697f59))
- **foldkit-viz:** opt-in clipping, and constant marks draw once ([3c4dbcc](https://github.com/opsydyn/fold-kit-experiments/commit/3c4dbcc67bd81a04788f5f0cec3722bba50f72da))
- **foldkit-viz:** plot column tables and Arrow data without building rows ([484308d](https://github.com/opsydyn/fold-kit-experiments/commit/484308de8c038a910925907d104c1c482f826b7f))
- **foldkit-viz:** polar coordinates and the arc mark ([0560316](https://github.com/opsydyn/fold-kit-experiments/commit/0560316eec4b9b91e901dd1e423f58c88cfc4ee6))
- **foldkit-viz:** projected maps ([46db107](https://github.com/opsydyn/fold-kit-experiments/commit/46db107b7a35b1b885b69fbc78d0b65b7db0e1de))
- **foldkit-viz:** publish a JSON Schema for plot specs ([c1b0ee9](https://github.com/opsydyn/fold-kit-experiments/commit/c1b0ee91f230ad294384100abf5e1c8cd67c019d))
- **foldkit-viz:** rect mark and bin transform ([cc4ec4c](https://github.com/opsydyn/fold-kit-experiments/commit/cc4ec4c9f88a0bb374ccc022ae6febc0ed3eef79))
- **foldkit-viz:** regression with confidence bands, LOESS, ECDF, QQ and moving windows ([b5c56af](https://github.com/opsydyn/fold-kit-experiments/commit/b5c56af851188e362cbd1fa479ff94f125a08138))
- **foldkit-viz:** render plots with foldkit/plot, and chain transforms ([c49e8c5](https://github.com/opsydyn/fold-kit-experiments/commit/c49e8c56ce6571514b7dc769aa9d4e4c252ecc66))
- **foldkit-viz:** restyle dense marks without recompiling ([4376c0d](https://github.com/opsydyn/fold-kit-experiments/commit/4376c0d9837c75720a82a4698f97935993e30529))
- **foldkit-viz:** stacked and grouped bars, stacked areas ([15519fb](https://github.com/opsydyn/fold-kit-experiments/commit/15519fb8f3537cf2b8aebabdc8599e4868383195))
- **foldkit-viz:** symbol channel on dot marks ([8934abd](https://github.com/opsydyn/fold-kit-experiments/commit/8934abd481ce286ba434a719172528850c0bdef9))
- **foldkit-viz:** tree, pack, chord, arc diagram, force and voronoi marks ([a651c75](https://github.com/opsydyn/fold-kit-experiments/commit/a651c75e1fc639b0d60631898b7e5dfc60132076))
- **foldkit-viz:** treemap, sunburst, sankey and parallel coordinates marks ([f1908f6](https://github.com/opsydyn/fold-kit-experiments/commit/f1908f6bb9c024470522c429925425afb95f9925))
- **web:** data-science demo meeting the foldkit-viz 0.18.0 exit criteria ([8d4ca77](https://github.com/opsydyn/fold-kit-experiments/commit/8d4ca77a8d3d8bee6a5ec90087d0bb0f1966c82c))
- **web:** rebuild seven chart demos as plot specs, shipping no JavaScript ([a287bba](https://github.com/opsydyn/fold-kit-experiments/commit/a287bba980b39bba8d57e769543c13e9ab02b27d))

### Bug Fixes

- **foldkit-viz:** antimeridian rings, radial labels between spokes ([cd8a3fd](https://github.com/opsydyn/fold-kit-experiments/commit/cd8a3fd2aa406205a9379e69f4d16a5bce2d857b))
- **foldkit-viz:** clip canvas marks to the plot area and index only visible points ([ec60893](https://github.com/opsydyn/fold-kit-experiments/commit/ec60893634482ede56efce2d455eb24d04717993))
- **foldkit-viz:** Delaunay triangulation used the wrong orientation sign ([5402016](https://github.com/opsydyn/fold-kit-experiments/commit/5402016c24838ba11cf27fa61640133477a73fce))
- **foldkit-viz:** label very fine linear ticks in exponent notation ([6b972a4](https://github.com/opsydyn/fold-kit-experiments/commit/6b972a41addeeb1c4516b7769628f8b7db0bd43d))
- **foldkit-viz:** print a continuous legend's ends as readable numbers ([33d8df4](https://github.com/opsydyn/fold-kit-experiments/commit/33d8df462ddcd011320575ec49183c74dd30ca6e))
- **foldkit-viz:** thin crowded band labels, keep years ungrouped, size facet text ([f676cc8](https://github.com/opsydyn/fold-kit-experiments/commit/f676cc8d507272bcbc8c2a6787c8a55838f36c4a))

## [0.17.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.16.0...foldkit-viz-v0.17.0) (2026-11-13)

### Features

- **foldkit-viz:** orbit charts for modules around a core ([8d63c19](https://github.com/opsydyn/fold-kit-experiments/commit/8d63c196f4d76ccb974b27d7f017cfbcec728488))
- **foldkit-viz:** orbit charts for modules around a core ([0bb7c4e](https://github.com/opsydyn/fold-kit-experiments/commit/0bb7c4ed9a0140b4a0303364c67b70dc5308f15b))

## [0.16.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.15.0...foldkit-viz-v0.16.0) (2026-11-09)

### Features

- **zloz:** graph toolkit, architecture workbench and public websites ([04d44b1](https://github.com/opsydyn/fold-kit-experiments/commit/04d44b1367d9a70109daffeacefe5b298f6ab997))

## [0.15.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.14.1...foldkit-viz-v0.15.0) (2026-10-30)

### Features

- **tech-radar:** a controls sheet on phones ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **tech-radar:** a guided tour of each edition ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **tech-radar:** a link-preview image for every page ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **tech-radar:** keyboard shortcuts and a list of them ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **tech-radar:** what changed since your last visit ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **tech-radar:** write-ups, tags and tag pages for every entry ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))

### Bug Fixes

- **foldkit-viz:** clip Mercator at its square extent, as d3-geo does ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **samples:** bound a relay socket's connect to five seconds ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **web:** bullet ranges in either order, and the globe's details on phones ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **web:** keep only data in the animated bar chart's Model ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))
- **web:** turn off Vitest 5's file module cache ([de64bc6](https://github.com/opsydyn/fold-kit-experiments/commit/de64bc6b8f5f774c8e8980f87c51a23d360e4b3c))

## [0.14.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.14.0...foldkit-viz-v0.14.1) (2026-10-29)

### Bug Fixes

- **deps:** move to FoldKit 0.170 and Effect 4.1 with one Effect throughout ([ef2f8c2](https://github.com/opsydyn/fold-kit-experiments/commit/ef2f8c28215cf4d497b6483e3e3acc12f7a33496))

## [0.14.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.13.1...foldkit-viz-v0.14.0) (2026-10-29)

### Features

- **foldkit-viz:** sankey nodeSort null keeps the input order ([0576380](https://github.com/opsydyn/fold-kit-experiments/commit/05763808db7d3a87a35fe06ef7985722b1542589))

## [0.13.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.13.0...foldkit-viz-v0.13.1) (2026-10-28)

### Bug Fixes

- **deps:** accept FoldKit 0.169 and move the workspace to it ([b5e40b0](https://github.com/opsydyn/fold-kit-experiments/commit/b5e40b0317e594f38c0596aac49f79cccae4a974))
- **deps:** accept FoldKit 0.169 and move the workspace to it ([fc82d5d](https://github.com/opsydyn/fold-kit-experiments/commit/fc82d5de50151053514e9e7a0ab676a55141e755))

## [0.13.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.12.0...foldkit-viz-v0.13.0) (2026-10-14)

### Features

- add recorded earthquake globe with pure FoldKit SVG ([b524988](https://github.com/opsydyn/fold-kit-experiments/commit/b524988373e86ecd6d07914b2c49fe7a456cca1a))
- **viz:** add pure orthographic globe geometry ([fec7318](https://github.com/opsydyn/fold-kit-experiments/commit/fec731837247d3c1fa9779f2cca30ca8d91e578d))

### Bug Fixes

- **globe:** reject malformed views and overflowing gestures ([8a94256](https://github.com/opsydyn/fold-kit-experiments/commit/8a9425676cd507532e811087128b0735f0032845))

## [0.12.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.11.0...foldkit-viz-v0.12.0) (2026-10-11)

### Features

- **viz:** add bar geometry and expand promo gallery ([52f724c](https://github.com/opsydyn/fold-kit-experiments/commit/52f724c54eac893c2ad6d5cf2a85c7e20eb4e55e))
- **viz:** integrate Signal Desk and word-cloud promo work ([a51d64d](https://github.com/opsydyn/fold-kit-experiments/commit/a51d64dbb3609851829e3501a3d371e8f79b66f9))

## [0.11.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.10.1...foldkit-viz-v0.11.0) (2026-10-09)

FoldKit adapters now support `>=0.167.0 <0.168.0` with Effect `4.0.0`.
Pure geometry entry points still work without either optional peer. The keyed
comparison workbench is an application example, not a new public controller API.
See the [migration guide](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/migrations/foldkit-0.167.md)
and [release notes](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-0.167.md).

### Features

- support FoldKit 0.167 and keyed chart comparison ([6e3edf7](https://github.com/opsydyn/fold-kit-experiments/commit/6e3edf76d0e04047652c052e2254ccd67a2458d9))

## [0.10.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.10.0...foldkit-viz-v0.10.1) (2026-10-05)

### Bug Fixes

- support FoldKit 0.166.0 ([248636e](https://github.com/opsydyn/fold-kit-experiments/commit/248636efea03a2048432260da6261bb657a282dc))

## [0.10.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.9.0...foldkit-viz-v0.10.0) (2026-10-04)

### Release highlights

- Add accessor-based Cartesian line, scatter and histogram geometry, semantic light/dark themes and stable keyed styles.
- Add optional parent-builder FoldKit layers, annotation, replacement tooltip, symbol legend and raw data table.
- Preserve semantic child events and Commands in linked charts; migrate promo examples to responsive composition.
- Qualify packed pure/optional consumers and standalone generated projects outside the monorepo.
- Correct optional peer metadata and equal-domain linear midpoint projection.

### Features

- add FoldKit Viz promo site and composable charts ([6e951ef](https://github.com/opsydyn/fold-kit-experiments/commit/6e951ef96c018350cde5ee18100fae08171455b7))
- **viz:** add composable Cartesian geometry ([cfaf3bb](https://github.com/opsydyn/fold-kit-experiments/commit/cfaf3bb3f91c808834ab2798cf97eaf706d5928f))
- **viz:** add FoldKit chart layers and semantic composition ([bd6b2c9](https://github.com/opsydyn/fold-kit-experiments/commit/bd6b2c9493052abd28b35b07e6860256bb475e62))
- **viz:** add semantic chart themes and keyed styles ([9bcbb21](https://github.com/opsydyn/fold-kit-experiments/commit/9bcbb219d8dd106042f9ecff029736ddd26ab048))

### Bug Fixes

- clear oxlint warnings ([4bd5016](https://github.com/opsydyn/fold-kit-experiments/commit/4bd5016f71dde9621bb5bbd6b587792f9585e6ea))
- **viz:** validate numeric chart boundaries and preserve tick precision ([5a6cf4c](https://github.com/opsydyn/fold-kit-experiments/commit/5a6cf4c4ee914df62db7be15ef1b89679d51391c))

## [0.9.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.8.0...foldkit-viz-v0.9.0) (2026-09-20)

### Features

- **viz:** add stateflow layout primitives ([0513750](https://github.com/opsydyn/fold-kit-experiments/commit/051375015dcd062c5da40ae2567d7da610fc69d8))

## [0.8.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.7.0...foldkit-viz-v0.8.0) (2026-08-20)

### Features

- **astro-foldkit:** document opt-in server rendering ([53e9d00](https://github.com/opsydyn/fold-kit-experiments/commit/53e9d004c75c10245d0aa88fc4c412b96c7f2f4c))
- support FoldKit 0.136 ([50f4134](https://github.com/opsydyn/fold-kit-experiments/commit/50f4134d7596926fed373408642816736907934f))

### Bug Fixes

- **astro-foldkit:** keep define-page markers inert ([0fb4e54](https://github.com/opsydyn/fold-kit-experiments/commit/0fb4e54dbd3a0b53f21de57f27f3948e13fcf80b))

## [0.7.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.6.0...foldkit-viz-v0.7.0) (2026-07-18)

### Features

- **foldkit-viz:** add selection contract ([1526cd6](https://github.com/opsydyn/fold-kit-experiments/commit/1526cd6b4c97ec2a76604faf2849931c3be3525a))

### Bug Fixes

- **foldkit-viz:** clean smoke fixture failures ([df6a842](https://github.com/opsydyn/fold-kit-experiments/commit/df6a8425c495d237ac6251bbe01328fd21ba2f39))
- **foldkit-viz:** package selection subpath ([54d770f](https://github.com/opsydyn/fold-kit-experiments/commit/54d770f7584c95abc01bf58f4573c5c8065391f9))
- **foldkit-viz:** use async smoke fixture cleanup ([6d146de](https://github.com/opsydyn/fold-kit-experiments/commit/6d146dec9db63c50ff6c3d2d866def8e31885a30))

## [0.6.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.5.0...foldkit-viz-v0.6.0) (2026-07-18)

### Features

- **astro-foldkit:** add lazy app entry API ([9786bdd](https://github.com/opsydyn/fold-kit-experiments/commit/9786bdd226cfd2200b6e64d5b198a53a7aad6d13))

## [0.5.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.4.2...foldkit-viz-v0.5.0) (2026-07-18)

### Features

- **foldkit-viz:** support foldkit 0.129 ([3fe1a7a](https://github.com/opsydyn/fold-kit-experiments/commit/3fe1a7ab97f020be44b9bcaac53b524d4920db43))

## [0.4.2](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.4.1...foldkit-viz-v0.4.2) (2026-07-15)

### Bug Fixes

- align packages with foldkit 0.128.1 ([ebadeaa](https://github.com/opsydyn/fold-kit-experiments/commit/ebadeaaf29e854660aa2d5c9eba04c017269d075))

## [0.4.1](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.4.0...foldkit-viz-v0.4.1) (2026-06-12)

### Bug Fixes

- correct repository url for npm provenance ([723fc7f](https://github.com/opsydyn/fold-kit-experiments/commit/723fc7f932ab6bbfd077b2a49df4904624ff89d2))

## [0.4.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.3.0...foldkit-viz-v0.4.0) (2026-06-12)

### Features

- :arrow_up: bump foldkit to 0.108.0 and migrate runtime API ([7441538](https://github.com/opsydyn/fold-kit-experiments/commit/744153844de11b096e2434e7e678d1149238d1b0))
- :rotating_light: add Effect language service and linteffect rules ([c2fad21](https://github.com/opsydyn/fold-kit-experiments/commit/c2fad2198616a0df333bb41e8fe0aaa9af9c433c))
- :sparkles: a111y and tiled grid ([5d8bb60](https://github.com/opsydyn/fold-kit-experiments/commit/5d8bb603d662a937b07732ececf6c94bdb916b1b))
- :sparkles: add data viz ([8992086](https://github.com/opsydyn/fold-kit-experiments/commit/89920867f65a5befa9f00089c025355f5ad23140))
- :sparkles: add tween and type doc ([a37d6ee](https://github.com/opsydyn/fold-kit-experiments/commit/a37d6ee8ccafb5ee331172855b851c3ae10fc1e8))
- :sparkles: charts update ([c0a71ac](https://github.com/opsydyn/fold-kit-experiments/commit/c0a71ac898a070840e68fab926debb72f2263ef0))
- :sparkles: charts updates ([cd052d9](https://github.com/opsydyn/fold-kit-experiments/commit/cd052d9e0bccd7994ec2f4283fb3e2ccff9bc030))
- :sparkles: foldkit upgrade ([cafc368](https://github.com/opsydyn/fold-kit-experiments/commit/cafc36852352e66c7446e06701eaa87103279ff0))
- :sparkles: force graph ([044da69](https://github.com/opsydyn/fold-kit-experiments/commit/044da69eff603d097a5ef68ecc27f4bbbbe92135))
- :sparkles: prop enhance for charts ([394c068](https://github.com/opsydyn/fold-kit-experiments/commit/394c06859c330a86bdd26b99c40681970d81b32e))
- :sparkles: refaactor charts and bloom ([b139fba](https://github.com/opsydyn/fold-kit-experiments/commit/b139fbaf0df6c9b0b6b1a21142c48c50a514a5a3))
- :sparkles: storybook primitives ([c8e81c7](https://github.com/opsydyn/fold-kit-experiments/commit/c8e81c7a2a31b4bc87e8d967dc59c10e918c5d6f))
- :sparkles: theming and storybook ([00beadc](https://github.com/opsydyn/fold-kit-experiments/commit/00beadc87552b76b75c2f3a4fe87965404833d4b))
- :sparkles: update charts lib ([3e848db](https://github.com/opsydyn/fold-kit-experiments/commit/3e848db975f6f492e99de966057953c3230b4806))
- :sparkles: viz usability roadmap work ([dc082c3](https://github.com/opsydyn/fold-kit-experiments/commit/dc082c33583879a91d6d41b96a2e46468165edb9))
- :white_check_mark: updated chrt lib ([ff99bc0](https://github.com/opsydyn/fold-kit-experiments/commit/ff99bc093ccfa8e05ad6ddc75456d728453d899d))

### Bug Fixes

- :white_check_mark: resolve all biome lint errors ([b09399d](https://github.com/opsydyn/fold-kit-experiments/commit/b09399dc0c9e68a2cca0fc53c0a1b59c2b517c90))

## [0.3.0] — 2026-06-05

### Added

**`shape/geo` — major upgrade**

- 4 new projections: `geoNaturalEarth1`, `geoOrthographic`, `geoAlbers`, `geoAlbersUsa`
- `ProjectionObject` — rich callable with `fitSize(size, object)` / `fitExtent(extent, object)` / `withScale` / `withTranslate`; auto-scales projection to fill SVG (D3 `fitSize` algorithm, `REF_SCALE=150`)
- `GeoPathFn` — path renderer with `.bounds(obj)` and `.centroid(obj)` methods for bounding box and label placement
- `geoBounds(proj, obj)` / `geoCentroid(proj, obj)` — standalone helpers
- New exported types: `GeoBBox`, `GeoCoord`, `GeoFeature`, `GeoFeatureCollection`, `GeoObject`, `GeoPathFn`, `Projection`, `ProjectionObject`

**Choropleth chart** (in `apps/web`)

- `ui/choropleth-map` — reusable chart primitive: TopoJSON-agnostic, data-driven color encoding, centroid-anchored hover tooltip, sequential color legend
- `apps/choropleth` — TEA app: `world-atlas` 110m countries + `topojson-client` conversion, internet penetration dataset

---

## [0.2.0] — 2026-06-05

### Added

**New modules**

- `math/array` — `extent`, `sum`, `mean`, `median`, `variance`, `deviation`, `cumsum`, `group`, `rollup`, `bisect`/`bisectLeft`, `pairs`, `zip`, `range`
- `math/tween` — `Tween` type, `tweenCreate`, `tweenStep`, `tweenValue`, `tweenPath`, `tweenDone`, `allTweensDone`; easing functions: `easeLinear`, `easeOutCubic`, `easeInCubic`, `easeInOutCubic`, `easeOutElastic`, `easeOutBack`
- `math/brush` — `BrushState`, `StartedBrush`/`MovedBrush`/`EndedBrush`/`ClearedBrush`, `brushUpdate`, `brushExtent`, `brushContains`, `brushDomain`
- `shape/areaRadial` — `areaRadial`, `wedge` for polar area charts and wind roses

**Scale additions** (`math/scale`)

- `linearInvertible` — linear scale with `.invert()` reverse lookup
- `niceLinear` — expand domain to round tick boundaries
- `scaleQuantile` — quantile bucketing
- `scaleQuantize` — equal-width discrete range
- `scaleSequential` — continuous domain → interpolator
- `scalePow` — generalised power scale
- `scaleSymlog` — symmetric log (handles zero/negative)
- `scaleIdentity` — 1:1 passthrough

**Curve types** (`shape/line`)

- `curveStep`, `curveStepBefore`, `curveStepAfter`
- `curveNatural` — cubic natural spline (D3 Thomas algorithm)
- `curveBasisOpen`, `curveBasisClosed`
- `curveCardinalOpen`, `curveCardinalClosed`
- `curveCatmullRomOpen`, `curveCatmullRomClosed`

**Time utilities** (`math/time`)

- `timeFormat(specifier)` — full `%Y %m %d %H %M %S %b %B %a %A %%` directive set
- `timeParse(specifier)` — inverse of `timeFormat`

**Colour schemes** (`math/schemes`)

- `wong`, `ibmCarbon`, `tolMuted` — colour-blind safe categorical palettes
- `viridis`, `magma`, `inferno`, `plasma`, `cividis` — perceptual sequential palettes

### Fixed

- `shape/geo.ts` — null-guard on coordinate array access in `ringPath`/`linePath`
- `shape/line.ts` — `CatmullRomOpenCurve`/`CatmullRomClosedCurve` now use composition instead of inheritance to avoid private member access
- `math/scale.ts` — `linearInvertible` uses `Object.assign` intersection type (no cast required)
- `math/bin.ts` — renamed `valueOf` local to `accessor` (no longer shadows global)
- `math/delaunay.ts` — `@ts-nocheck` for TypedArray `noUncheckedIndexedAccess` false-positives; `noSelfCompare` fixed with `Number.isNaN`
- `simulation/` — `isNaN` → `Number.isNaN` throughout; LCG assignment extracted from expression

### Internal

- TypeDoc config (`typedoc.json`) + `bun run docs` script
- Test harness: `runChart`, `assertScaleRange`, `assertMonotone`, `assertApprox`, `collectText`, `collectAttr`, `countElements`, `findNodes`
- 119 tests across 9 files (up from 0)

---

## [0.1.0] — 2025 (initial)

Initial release with:

- `math/scale` — `linear`, `log`, `band`, `point`, `ordinal`, `sqrt`, `threshold`
- `math/color` — `interpolateRgb`, `interpolateLab`, `interpolateHsl`, `colorScale`, `divergingScale`
- `math/schemes` — `tableau10`, `category10`, `dark2`, `set1`, diverging + sequential palettes
- `math/stats` — `boxStats`, `kde`, `silvermanBandwidth`, `quantile`
- `math/bin` — histogram binning
- `math/zoom` — viewport transform
- `math/ease` — standard easing functions
- `math/contour` — density contour (marching squares)
- `math/delaunay` — Delaunay triangulation + Voronoi
- `math/random` — LCG-based deterministic random
- `math/format` — number formatting
- `math/time` — `scaleTime`, `timeTicks`, `timeNice`, `timeTickFormat`
- `shape/line` — `line` with `linear`, `catmullRom`, `monotoneX`, `basis`, `cardinal` curves
- `shape/area` — filled area
- `shape/arc` — pie/donut arcs
- `shape/pie` — angle computation
- `shape/path` — SVG path builder
- `shape/stack` — stacked series
- `shape/chord` — chord diagram
- `shape/sankey` — Sankey layout
- `shape/geo` — map projections + GeoJSON path
- `shape/link` — vertical/horizontal links
- `shape/lineRadial` — polar line
- `shape/symbol` — symbol markers
- `hierarchy` — tree layout, pack layout
- `simulation` — N-body force simulation (Barnes-Hut quadtree)
