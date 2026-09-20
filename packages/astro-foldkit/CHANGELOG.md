# Changelog

## [0.7.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.6.0...astro-foldkit-v0.7.0) (2026-09-20)


### Features

* **web:** add stateflow observatory ([b50446e](https://github.com/opsydyn/fold-kit-experiments/commit/b50446e11f2fad81d1b5799974dd1ab10b705f1f))


### Bug Fixes

* align Vite plugin with Effect rc.116 ([33682f8](https://github.com/opsydyn/fold-kit-experiments/commit/33682f8fda999ee82d963d5d6687aee56f08c413))
* satisfy Astro smoke lint contract ([f67f71e](https://github.com/opsydyn/fold-kit-experiments/commit/f67f71e4f7b2ce480ccce841c1dcd4ef3c81cdf7))
* **web:** complete stateflow SSR and replay interactions ([d71ad2a](https://github.com/opsydyn/fold-kit-experiments/commit/d71ad2aeaf5ad0f1a8ff4e86c77ba99d5da3368f))

## [0.6.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.5.0...astro-foldkit-v0.6.0) (2026-08-20)


### Features

* **astro-foldkit:** add server render handoff ([9773a4d](https://github.com/opsydyn/fold-kit-experiments/commit/9773a4d1883c53fa60957368a0125d3b57b7cd24))
* **astro-foldkit:** document opt-in server rendering ([53e9d00](https://github.com/opsydyn/fold-kit-experiments/commit/53e9d004c75c10245d0aa88fc4c412b96c7f2f4c))
* **astro-foldkit:** expose server document resolver ([969dc2f](https://github.com/opsydyn/fold-kit-experiments/commit/969dc2f7e4a679df8b04d60c57783d6b8fb84bd1))
* **astro-foldkit:** formalize define-page contract ([62863c5](https://github.com/opsydyn/fold-kit-experiments/commit/62863c58fa1462d2ecb04bd52cf3d5e0bb444601))
* **astro-foldkit:** hydrate page owners on client ([9f8f76b](https://github.com/opsydyn/fold-kit-experiments/commit/9f8f76bef77ea734006c1faa90defdfdd115d09d))
* support FoldKit 0.136 ([50f4134](https://github.com/opsydyn/fold-kit-experiments/commit/50f4134d7596926fed373408642816736907934f))


### Bug Fixes

* **astro-foldkit:** align server document tests ([f71c2c2](https://github.com/opsydyn/fold-kit-experiments/commit/f71c2c2ccea94f148e81126b00174375566fa5bb))
* **astro-foldkit:** keep define-page markers inert ([0fb4e54](https://github.com/opsydyn/fold-kit-experiments/commit/0fb4e54dbd3a0b53f21de57f27f3948e13fcf80b))
* **astro-foldkit:** pass stamped root to page hydration ([b3b3ba6](https://github.com/opsydyn/fold-kit-experiments/commit/b3b3ba65c4bb25bb9c2738f82d1148e5e6407679))
* **astro-foldkit:** reject empty server build id ([320bc39](https://github.com/opsydyn/fold-kit-experiments/commit/320bc39a9ca8d610fe60480c0c399a71fc029b51))

## [0.5.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.4.0...astro-foldkit-v0.5.0) (2026-07-18)

### Features

- **astro-foldkit:** add lazy app entry API ([9786bdd](https://github.com/opsydyn/fold-kit-experiments/commit/9786bdd226cfd2200b6e64d5b198a53a7aad6d13))

## [0.4.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.3.0...astro-foldkit-v0.4.0) (2026-07-18)

### Features

- **astro-foldkit:** support foldkit 0.129 ([345b18c](https://github.com/opsydyn/fold-kit-experiments/commit/345b18c325706ae2aebbe7c1c3a5bded2248e343))

## [0.3.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.2.1...astro-foldkit-v0.3.0) (2026-07-15)

### Features

- **astro-foldkit:** add navigation event contract ([5d4678d](https://github.com/opsydyn/fold-kit-experiments/commit/5d4678d94eac9e5e9f6d6f15e9d4074f1e99df3d))
- **astro-foldkit:** define stable ssr shell ([e325b89](https://github.com/opsydyn/fold-kit-experiments/commit/e325b89f63515194abf37a85f568dddef4d97855))
- **astro-foldkit:** forward navigation through inbound ports ([da6ade5](https://github.com/opsydyn/fold-kit-experiments/commit/da6ade569a312b886a5732f1a401a47b065f4f20))
- **astro-foldkit:** type application contract ([9fbc36d](https://github.com/opsydyn/fold-kit-experiments/commit/9fbc36de9fde1e17b2d29d791d620bc9eddf573a))

### Bug Fixes

- address astro navigation review findings ([ec6faad](https://github.com/opsydyn/fold-kit-experiments/commit/ec6faad38c05d9a1b5d5fe32a710215864fe8fb6))
- align packages with foldkit 0.128.1 ([ebadeaa](https://github.com/opsydyn/fold-kit-experiments/commit/ebadeaaf29e854660aa2d5c9eba04c017269d075))
- **astro-foldkit:** make island disposal one-shot ([694e17a](https://github.com/opsydyn/fold-kit-experiments/commit/694e17a32453c6f98561f6f2cb767d3c4c59ab8a))
- **astro-foldkit:** preserve schema overlay compatibility ([4f4be0b](https://github.com/opsydyn/fold-kit-experiments/commit/4f4be0b5da7bebb7c40acb535727acd8f448a903))
- **astro-foldkit:** scope navigation to island lifecycle ([e8627d8](https://github.com/opsydyn/fold-kit-experiments/commit/e8627d82cb7a76e4887b7e40121e2d6cf3906347))
- resolve final astro navigation review findings ([baefd61](https://github.com/opsydyn/fold-kit-experiments/commit/baefd615231832ffca5dc10d18f4919e7672d3f9))

## [0.2.1](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.2.0...astro-foldkit-v0.2.1) (2026-06-12)

### Bug Fixes

- correct repository url for npm provenance ([723fc7f](https://github.com/opsydyn/fold-kit-experiments/commit/723fc7f932ab6bbfd077b2a49df4904624ff89d2))

## [0.2.0](https://github.com/opsydyn/fold-kit-experiments/compare/astro-foldkit-v0.1.0...astro-foldkit-v0.2.0) (2026-06-12)

### Features

- :arrow_up: bump foldkit to 0.108.0 and migrate runtime API ([7441538](https://github.com/opsydyn/fold-kit-experiments/commit/744153844de11b096e2434e7e678d1149238d1b0))
- :rotating_light: add Effect language service and linteffect rules ([c2fad21](https://github.com/opsydyn/fold-kit-experiments/commit/c2fad2198616a0df333bb41e8fe0aaa9af9c433c))
- :sparkles: add prop to remove foldkit meta data optionally ([2ae7989](https://github.com/opsydyn/fold-kit-experiments/commit/2ae798977b7e78706bf329bef394f6e1604e2f73))
- :sparkles: add props to fold kit ([de04151](https://github.com/opsydyn/fold-kit-experiments/commit/de04151cd0bbe54c1fc4e36af34836fb5c39d4c3))
- :sparkles: charts updates ([cd052d9](https://github.com/opsydyn/fold-kit-experiments/commit/cd052d9e0bccd7994ec2f4283fb3e2ccff9bc030))
- :sparkles: foldkit upgrade ([cafc368](https://github.com/opsydyn/fold-kit-experiments/commit/cafc36852352e66c7446e06701eaa87103279ff0))
- :sparkles: mono repo refactor ([18079de](https://github.com/opsydyn/fold-kit-experiments/commit/18079de599b3848a50b89bfe897ad47f50f43919))
- :sparkles: prepare package for npm ([3d5850b](https://github.com/opsydyn/fold-kit-experiments/commit/3d5850bf536b2d10ae1483bd108a2eda89de321a))
- :sparkles: tests for package ([086808d](https://github.com/opsydyn/fold-kit-experiments/commit/086808daafdc5331609fcf34fa1734d7d2d5b28f))

### Bug Fixes

- :white_check_mark: resolve all biome lint errors ([b09399d](https://github.com/opsydyn/fold-kit-experiments/commit/b09399dc0c9e68a2cca0fc53c0a1b59c2b517c90))
