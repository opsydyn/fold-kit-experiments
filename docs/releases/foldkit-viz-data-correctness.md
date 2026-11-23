# FoldKit Viz data correctness changes

- Arrow numeric vectors preserve missing values when the vector exposes its validity count and iterator. A null observation renders as a gap or omitted point, and its table cell is blank.
- SQL pushdown includes a mark's explicit key field in its projection. Constant annotations stay local and draw once.
- Dense append takes its data from the plot's shared source. Move a mark-local table to the plot or recompile with its full data before appending.
- Square-root scales apply the signed transform before interpolation. Non-zero and signed domains can now give different positions. Equal square-root and power domains map to the range midpoint.
