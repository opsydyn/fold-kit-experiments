# ADR 0127 Compose and decode Viz plots at the Effect boundary

## Status

Accepted for local implementation on 2026-11-23.

## Context

ADR 0037 defines a portable grammar and a pure compiler. Dash currently asserts that unknown input is a PlotSpec and parses paths out of exception text. TypeScript chart authors have to choose between data-typed Cartesian geometry and grammar channels whose fields are arbitrary strings. The chart compiler and static renderers also serve applications without Effect.

## Decision

Expose an optional `effect/plot` subpath with an Effect Schema decoder derived from the published JSON Schema and a checked compiler returning Effect Result. Keep wire columns as JSON arrays. Keep runtime column storage and synchronous projection in the core. Compiler rejections retain their RangeError compatibility and carry a machine-readable spec path. Dash adds document context to those diagnostics. Unexpected defects propagate to the caller.

Start typed authoring with two data-backed marks and a constant rule. Compose the resulting marks in drawing order into the existing grammar. The FoldKit parent owns loading and interaction. A packed consumer without peers remains a release check.

## Linked-view contract

Expose point and interval targets for an explicitly chosen mark and facet in the pure plot API. Hit indexing uses the same centre-based clipping policy for ordinary and packed points. The FoldKit example owns the filter and reconciles both children when it changes. Keyboard and pointer events resolve through the same targets. Histogram tables expose the displayed interval and aggregate rather than the raw input rows.

## Alternatives and consequences

An independently written Effect schema would duplicate the grammar and its validation cases. Making the core depend on Effect would alter install and rendering contracts for pure consumers. The optional subpath costs an additional bundle and requires checking schema import behavior against the exported JSON fixtures. Share authoring fragments through ordinary functions and add constructors as consumer needs establish them.
