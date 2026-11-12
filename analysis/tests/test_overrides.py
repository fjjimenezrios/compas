import json

import numpy as np
import pytest

from flamenco_study import cycles, overrides

BEATS = np.arange(60) * 0.27


def test_load_missing_file_returns_default(tmp_path):
    assert overrides.load(tmp_path / "nope.json") == overrides.default()


def test_save_and_load_roundtrip(tmp_path):
    path = tmp_path / "user" / "overrides.json"
    data = {"shift_beats": -1, "anchors": [5.4, 1.0], "no_compas": [[2, 3.5]], "notes": "ojo al remate"}
    overrides.save(path, data)
    loaded = overrides.load(path)
    assert loaded["anchors"] == [1.0, 5.4]
    assert loaded["no_compas"] == [[2.0, 3.5]]
    assert json.loads(path.read_text())["notes"] == "ojo al remate"


@pytest.mark.parametrize("bad", [
    {"shift_beats": 1.5},
    {"shift_beats": True},
    {"anchors": ["x"]},
    {"no_compas": [[3, 2]]},
    {"no_compas": [[1]]},
    {"notes": 3},
    [],
])
def test_normalize_rejects_invalid(bad):
    with pytest.raises(ValueError):
        overrides.normalize(bad)


def test_shift_moves_every_cycle_start():
    o = overrides.normalize({"shift_beats": 1})
    assert overrides.effective_starts(BEATS, 12, 3, o)[:3] == [4, 16, 28]
    o = overrides.normalize({"shift_beats": -4})
    assert overrides.effective_starts(BEATS, 12, 3, o)[:2] == [11, 23]


def test_anchor_rephases_from_that_point_on():
    o = overrides.normalize({"anchors": [BEATS[30] + 0.02]})
    starts = overrides.effective_starts(BEATS, 12, 3, o)
    assert starts == [3, 15, 27, 30, 42, 54]
    spans = cycles.spans_from_starts(starts, len(BEATS), 12)
    assert spans[2] == (27, 30)  # cut short by the anchor -> partial cycle


def test_no_compas_marks_overlapping_cycles():
    o = overrides.normalize({"no_compas": [[BEATS[14], BEATS[16]]]})
    spans = cycles.spans_from_starts(overrides.effective_starts(BEATS, 12, 0, o), len(BEATS), 12)
    built = cycles.build_cycles(BEATS, np.zeros(len(BEATS)), spans, 12, list(range(1, 13)), None, o["no_compas"])
    assert [c["no_compas"] for c in built["cycles"]] == [False, True, False, False, False]
