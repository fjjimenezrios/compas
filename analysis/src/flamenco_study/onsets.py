import librosa
import numpy as np

from flamenco_study.beats import HOP

PEAKS_PER_SECOND = 100


def detect(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=envelope, sr=sr, hop_length=HOP, units="frames")
    if not len(frames):
        return np.array([]), np.array([])
    raw = envelope[frames]
    # Normalized per stem: strength is relative to that layer's own loud hits, not across layers.
    ref = np.percentile(raw, 95) or 1.0
    return librosa.frames_to_time(frames, sr=sr, hop_length=HOP), np.clip(raw / ref, 0, 1)


def assign(
    times: np.ndarray,
    strengths: np.ndarray,
    beat_times: np.ndarray,
    spans: list[tuple[int, int]],
    order: list[int],
    subdivision: int,
) -> list[dict]:
    position = {}
    for c, (a, b) in enumerate(spans):
        for k in range(b - a):
            position[a + k] = (c, order[k])

    out = []
    for t, s in zip(times, strengths):
        i = int(np.searchsorted(beat_times, t, side="right")) - 1
        if i < 0 or i >= len(beat_times) - 1:
            continue
        ibi = beat_times[i + 1] - beat_times[i]
        frac = (t - beat_times[i]) / ibi
        sub = int(round(frac * subdivision))
        offset_ms = (frac - sub / subdivision) * ibi * 1000
        if sub == subdivision:
            i, sub = i + 1, 0
        cycle, beat = position.get(i, (None, None))
        out.append({
            "t": round(float(t), 4),
            "strength": round(float(s), 3),
            "cycle": cycle,
            "beat": beat,
            "sub": sub,
            "offset_ms": round(float(offset_ms), 1),
        })
    return out


def peaks(y: np.ndarray, sr: int) -> list[float]:
    step = sr // PEAKS_PER_SECOND
    n = len(y) // step
    blocks = np.abs(y[: n * step]).reshape(n, step).max(axis=1)
    top = blocks.max() or 1.0
    return [round(float(v), 3) for v in blocks / top]
