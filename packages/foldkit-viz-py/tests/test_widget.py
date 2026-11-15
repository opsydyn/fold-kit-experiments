import json
from pathlib import Path

import pytest

import re

import traitlets

from foldkit_viz import THEMES, Plot, PlotSpecError, validate

SPEC = {
    "width": 360,
    "height": 220,
    "title": "Dose response",
    "data": [{"dose": 1, "response": 2}, {"dose": 2, "response": 4}],
    "marks": [{"mark": "dot", "x": "dose", "y": "response"}],
}


def test_a_valid_spec_passes():
    validate(SPEC)


def test_a_column_table_passes():
    validate({**SPEC, "data": {"length": 2, "columns": {"dose": [1, 2], "response": [2, 4]}}})


def test_an_error_names_its_spec_path():
    with pytest.raises(PlotSpecError) as caught:
        validate({**SPEC, "marks": [{"mark": "dot", "x": "dose", "y": "response", "fil": "g"}]})
    assert str(caught.value) == "marks[0]: Additional properties are not allowed ('fil' was unexpected)"
    assert caught.value.errors


def test_an_unknown_mark_lists_the_marks():
    with pytest.raises(PlotSpecError, match=r"^marks\[0\]: mark 'dott' is not one of \[.*'dot'.*\]$"):
        validate({**SPEC, "marks": [{"mark": "dott", "x": "dose"}]})


def test_a_misspelt_top_level_key_is_rejected():
    with pytest.raises(PlotSpecError, match="titel"):
        validate({**SPEC, "titel": "x"})


def test_an_unknown_scheme_is_rejected():
    with pytest.raises(PlotSpecError, match=r"^color\.scheme: "):
        validate({**SPEC, "color": {"scheme": "rainbow"}})


def test_the_widget_syncs_its_spec_and_bundled_front_end():
    plot = Plot(SPEC)
    assert plot.spec == SPEC
    assert plot.error == ""
    assert "spec" in plot.keys and "error" in plot.keys
    assert "render" in (Path(__file__).parents[1] / "src/foldkit_viz/static/widget.js").read_text()


def test_the_widget_refuses_an_invalid_spec_and_keeps_the_last_good_one():
    plot = Plot(SPEC)
    with pytest.raises(PlotSpecError):
        plot.spec = {**SPEC, "width": "wide"}
    assert plot.spec == SPEC


def test_the_widget_cannot_be_constructed_from_an_invalid_spec():
    with pytest.raises(PlotSpecError):
        Plot({"marks": []})


def test_the_bundled_schema_is_the_published_one():
    bundled = Path(__file__).parents[1] / "src/foldkit_viz/static/plot-spec.schema.json"
    published = Path(__file__).parents[2] / "foldkit-viz/schema/plot-spec.schema.json"
    assert json.loads(bundled.read_text()) == json.loads(published.read_text())


def test_the_widget_takes_a_named_theme_and_follows_the_notebook_without_one():
    assert Plot(SPEC).theme is None
    plot = Plot(SPEC, theme="high-contrast-dark")
    assert plot.theme == "high-contrast-dark"
    plot.theme = None
    assert "theme" in plot.keys


def test_an_unknown_theme_is_refused():
    with pytest.raises(traitlets.TraitError):
        Plot(SPEC, theme="sepia")


def test_the_theme_names_are_foldkit_vizs():
    source = (Path(__file__).parents[2] / "foldkit-viz/src/chart/theme.ts").read_text()
    union = re.search(r"export type ThemeName = ([^;]+);", source)
    assert union is not None
    assert tuple(re.findall(r"'([a-z-]+)'", union.group(1))) == THEMES
