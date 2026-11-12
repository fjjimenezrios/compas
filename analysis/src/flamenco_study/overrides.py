import json
from pathlib import Path

import numpy as np


def default() -> dict:
    return {"shift_beats": 0, "anchors": [], "no_compas": [], "notes": ""}


def normalize(data: dict) -> dict:
    if not isinstance(data, dict):
        raise ValueError("overrides debe ser un objeto JSON")
    out = default()
    shift = data.get("shift_beats", 0)
    if not isinstance(shift, int) or isinstance(shift, bool):
        raise ValueError("shift_beats debe ser un entero")
    out["shift_beats"] = shift
    anchors = data.get("anchors", [])
    if not isinstance(anchors, list) or not all(isinstance(t, (int, float)) and t >= 0 for t in anchors):
        raise ValueError("anchors debe ser una lista de segundos")
    out["anchors"] = sorted(float(t) for t in anchors)
    ranges = data.get("no_compas", [])
    if not isinstance(ranges, list) or not all(
        isinstance(r, list) and len(r) == 2 and all(isinstance(t, (int, float)) for t in r) and r[0] < r[1]
        for r in ranges
    ):
        raise ValueError("no_compas debe ser una lista de [inicio, fin] en segundos")
    out["no_compas"] = [[float(a), float(b)] for a, b in ranges]
    notes = data.get("notes", "")
    if not isinstance(notes, str):
        raise ValueError("notes debe ser texto")
    out["notes"] = notes
    return out


def load(path: Path) -> dict:
    if not path.exists():
        return default()
    return normalize(json.loads(path.read_text()))


def save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(normalize(data), ensure_ascii=False, indent=2))
    tmp.replace(path)


def effective_starts(beat_times: np.ndarray, cycle_len: int, first_start: int, overrides: dict) -> list[int]:
    n = len(beat_times)
    s0 = (first_start + overrides["shift_beats"]) % cycle_len
    starts = list(range(s0, n, cycle_len))
    for t in overrides["anchors"]:
        j = int(np.argmin(np.abs(beat_times - t)))
        starts = [s for s in starts if s < j] + list(range(j, n, cycle_len))
    return starts
