from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import anywidget
import traitlets
from jsonschema import Draft7Validator
from jsonschema.exceptions import ValidationError, best_match

_STATIC = Path(__file__).parent / "static"

#: The themes foldkit-viz names in chart/theme's ``chartThemes``.
THEMES = ("light", "dark", "high-contrast-light", "high-contrast-dark")
_VALIDATOR = Draft7Validator(json.loads((_STATIC / "plot-spec.schema.json").read_text()))


def _path_of(error: ValidationError) -> str:
    """A spec path as foldkit-viz writes it: ``marks[0].x``."""
    path = ""
    for part in error.absolute_path:
        path += f"[{part}]" if isinstance(part, int) else (f".{part}" if path else str(part))
    return path or "spec"


def _explain(error: ValidationError) -> ValidationError:
    """Inside a union of mark types, the error from the branch for the mark named.

    The schema writes a mark as one branch per mark type, so a bad mark fails
    every branch. Only the branch whose ``mark`` matches says what is wrong.
    """
    if error.validator != "anyOf" or not isinstance(error.instance, dict) or "mark" not in error.instance:
        return error
    by_branch: dict[int, list[ValidationError]] = {}
    for sub in error.context or []:
        by_branch.setdefault(sub.relative_schema_path[0], []).append(sub)
    named = [
        errors
        for errors in by_branch.values()
        if not any(list(sub.relative_path) == ["mark"] for sub in errors)
    ]
    if len(named) == 1:
        return _explain(best_match(named[0]))
    return error


def _describe(error: ValidationError) -> str:
    if error.validator == "anyOf" and isinstance(error.instance, dict) and "mark" in error.instance:
        marks = sorted({sub.validator_value for sub in error.context or [] if list(sub.relative_path) == ["mark"]})
        return f"mark {error.instance['mark']!r} is not one of {marks}"
    return error.message


class PlotSpecError(ValueError):
    """A spec the schema rejects. ``errors`` holds every problem, ``str()`` the likeliest."""

    def __init__(self, errors: list[ValidationError]) -> None:
        self.errors = errors
        best = _explain(best_match(errors))
        super().__init__(f"{_path_of(best)}: {_describe(best)}")


def validate(spec: dict[str, Any]) -> None:
    """Raise ``PlotSpecError`` unless ``spec`` follows the plot spec schema.

    The schema checks the spec's shape. What depends on the data, such as
    whether a field a channel names exists, only foldkit-viz can check when it
    draws; ``Plot.error`` then holds its message.
    """
    errors = list(_VALIDATOR.iter_errors(spec))
    if errors:
        raise PlotSpecError(errors)


class Plot(anywidget.AnyWidget):
    """A chart in a notebook, drawn from a plot spec.

    >>> Plot({"width": 480, "height": 300, "data": rows,
    ...       "marks": [{"mark": "dot", "x": "a", "y": "b"}]})

    Assigning ``spec`` or ``theme`` redraws the chart. The chart carries a
    plain-language summary and a data table for screen readers. With no
    ``theme`` it follows the notebook's light or dark theme; a named theme
    (one of ``THEMES``) paints its own background, as in
    ``Plot(spec, theme="high-contrast-dark")``.
    """

    _esm = _STATIC / "widget.js"
    spec = traitlets.Dict().tag(sync=True)
    theme = traitlets.Enum(THEMES, default_value=None, allow_none=True, help="A theme name, or None to follow the notebook.").tag(sync=True)
    error = traitlets.Unicode("", read_only=True, help="foldkit-viz's error drawing the spec, or ''.").tag(sync=True)

    def __init__(self, spec: dict[str, Any], theme: str | None = None, **kwargs: Any) -> None:
        super().__init__(spec=spec, theme=theme, **kwargs)

    @traitlets.validate("spec")
    def _check_spec(self, proposal: dict[str, Any]) -> dict[str, Any]:
        validate(proposal["value"])
        return proposal["value"]
