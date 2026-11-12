from pathlib import Path

import librosa
import numpy as np
from scipy.ndimage import median_filter

SR = 11025
HOP_S = 0.1
# A layer counts as playing when it is above this fraction of its own loud passages (its 99th percentile)
# and above an absolute floor, so a stem that is just background noise is never taken for music.
LOUD_PERCENTILE = 99
ACTIVE_FRACTION = 0.2
FLOOR = 0.005
MIN_SINGING_S = 4.0  # a short "olé" is not a section of cante
MERGE_GAP_S = 3.0  # a pause shorter than this is a breath, not the end of the cante


def _activity(path: Path | None) -> tuple[np.ndarray, float] | None:
    """True for every 0.1 s hop where the layer is playing, and the length of the audio in seconds."""
    if path is None or not path.exists():
        return None
    y, _ = librosa.load(path, sr=SR, mono=True)
    rms = librosa.feature.rms(y=y, frame_length=int(SR * 0.4), hop_length=int(SR * HOP_S))[0]
    loud = np.percentile(rms, LOUD_PERCENTILE)
    seconds = len(y) / SR
    if loud < 2 * FLOOR:
        return np.zeros(len(rms), dtype=bool), seconds
    # ~1 s of smoothing so breaths and note gaps don't cut a phrase in two.
    return median_filter((rms > max(ACTIVE_FRACTION * loud, FLOOR)).astype(np.uint8), size=11).astype(bool), seconds


def _runs(mask: np.ndarray) -> list[tuple[int, int]]:
    edges = np.flatnonzero(np.diff(np.concatenate(([0], mask.astype(np.int8), [0]))))
    return list(zip(edges[::2], edges[1::2]))


def detect_sections(vocals: Path, guitar: Path | None = None) -> list[dict]:
    """
    Splits a song into stretches of `cante` (voice playing), `toque` (guitar but no voice) and
    `instrumental` (neither, e.g. only palmas). Times are in seconds.
    """
    heard = _activity(vocals)
    if heard is None:
        return []
    voice, seconds = heard
    played = _activity(guitar)
    strings = played[0] if played else None

    singing = np.zeros_like(voice)
    runs = _runs(voice)
    merged: list[list[int]] = []
    for start, end in runs:
        if merged and (start - merged[-1][1]) * HOP_S <= MERGE_GAP_S:
            merged[-1][1] = end
        else:
            merged.append([start, end])
    for start, end in merged:
        if (end - start) * HOP_S >= MIN_SINGING_S:
            singing[start:end] = True

    sections: list[dict] = []

    def add(start: int, end: int, kind: str) -> None:
        if end <= start:
            return
        if sections and sections[-1]["kind"] == kind:
            sections[-1]["end"] = round(end * HOP_S, 1)
        else:
            sections.append({"start": round(start * HOP_S, 1), "end": round(end * HOP_S, 1), "kind": kind})

    n = len(singing)
    cursor = 0
    for start, end in _runs(singing) + [(n, n)]:
        if start > cursor:  # the stretch without cante before this one
            gap = slice(cursor, start)
            playing = strings is not None and strings[gap].mean() > 0.5
            add(cursor, start, "toque" if playing else "instrumental")
        add(start, end, "cante")
        cursor = end
    if sections:
        sections[-1]["end"] = round(seconds, 1)
    return sections
