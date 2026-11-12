from functools import lru_cache

import librosa
import numpy as np
from beat_this.inference import Audio2Beats

HOP = 256


@lru_cache(maxsize=1)
def _beat_this_model() -> Audio2Beats:
    # MPS isn't supported by Beat This!; CPU handles a full song in a few seconds.
    return Audio2Beats(checkpoint_path="final0", device="cpu", dbn=False)


def beat_this(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    beats, downbeats = _beat_this_model()(y, sr)
    return np.asarray(beats, dtype=float), np.asarray(downbeats, dtype=float)


def onset_envelope(y: np.ndarray, sr: int) -> np.ndarray:
    return librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)


def tracked_beats(envelope: np.ndarray, sr: int, bpm: float) -> np.ndarray:
    _, beats = librosa.beat.beat_track(
        onset_envelope=envelope, sr=sr, hop_length=HOP, start_bpm=bpm, tightness=400, units="time"
    )
    return np.asarray(beats, dtype=float)


def strength_at(envelope: np.ndarray, sr: int, times: np.ndarray, window_s: float = 0.04) -> np.ndarray:
    fps = sr / HOP
    w = max(1, int(window_s * fps))
    frames = np.round(np.asarray(times) * fps).astype(int)
    return np.array([envelope[max(0, f - w): f + w + 1].max(initial=0.0) for f in frames])


def bpm_of(beats: np.ndarray) -> float:
    return 60.0 / float(np.median(np.diff(beats)))


def stability(beats: np.ndarray) -> float:
    if len(beats) < 8:
        return float("inf")
    ibi = np.diff(beats)
    med = np.median(ibi)
    gaps = np.sum(ibi > 1.5 * med) + np.sum(ibi < 0.5 * med)
    return float(np.std(ibi) / med + gaps / len(ibi))


def fill_gaps(beats: np.ndarray) -> np.ndarray:
    if len(beats) < 3:
        return beats
    med = np.median(np.diff(beats))
    out = [beats[0]]
    for b in beats[1:]:
        missing = int(round((b - out[-1]) / med)) - 1
        if missing > 0:
            out.extend(np.linspace(out[-1], b, missing + 2)[1:-1])
        out.append(b)
    return np.asarray(out)


def fit_tempo_range(beats: np.ndarray, tempo_range, strength) -> np.ndarray:
    """`strength(times)` picks which half survives when the tempo is halved, so accents aren't dropped."""
    if not tempo_range or len(beats) < 4:
        return beats
    lo, hi = tempo_range
    for _ in range(3):
        bpm = bpm_of(beats)
        if bpm < lo and bpm * 2 <= hi * 1.15:
            mids = (beats[:-1] + beats[1:]) / 2
            beats = np.sort(np.concatenate([beats, mids]))
        elif bpm > hi and bpm / 2 >= lo * 0.85:
            even, odd = beats[0::2], beats[1::2]
            beats = even if strength(even).mean() >= strength(odd).mean() else odd
        else:
            break
    return beats


def choose(candidates: dict[str, np.ndarray]) -> tuple[str, np.ndarray, dict[str, float]]:
    scores = {name: stability(b) for name, b in candidates.items()}
    best = min(scores, key=scores.get)
    return best, candidates[best], scores
