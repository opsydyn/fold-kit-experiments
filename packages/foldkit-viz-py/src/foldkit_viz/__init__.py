"""Charts from @opsydyn/foldkit-viz plot specs in Jupyter.

A plot spec is plain JSON: data, and marks whose channels name fields. ``Plot``
checks a spec against the published schema and draws it with foldkit-viz
itself, so a chart in a notebook matches the same spec drawn anywhere else.
"""

from ._widget import Plot, PlotSpecError, validate

__all__ = ["Plot", "PlotSpecError", "validate"]
__version__ = "0.1.0"
