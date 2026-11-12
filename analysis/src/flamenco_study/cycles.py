import numpy as np

LOW_CONFIDENCE = 0.35
LOCAL_WINDOW = 2  # cycles on each side used for the local template match


def template(cycle_len: int, accents, order: list[int]) -> np.ndarray | None:
    if not accents:
        return None
    return np.array([1.0 if n in accents else 0.0 for n in order])


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    mask = ~np.isnan(a)
    if mask.sum() < 3 or np.std(a[mask]) == 0 or np.std(b[mask]) == 0:
        return 0.0
    return float(np.corrcoef(a[mask], b[mask])[0, 1])


def display_order(cycle_len: int, count_start: int) -> list[int]:
    return [((count_start - 1 + k) % cycle_len) + 1 for k in range(cycle_len)]


def profile_by_number(strengths: np.ndarray, cycle_len: int, first_beat: int) -> np.ndarray:
    return np.array([strengths[(first_beat + k) % cycle_len :: cycle_len].mean() for k in range(cycle_len)])


def find_first_beat(strengths: np.ndarray, cycle_len: int, accents) -> tuple[int, float | None]:
    """Index (0..N-1) of the first beat numbered 1, chosen by template match."""
    natural = list(range(1, cycle_len + 1))
    tpl = template(cycle_len, accents, natural)
    if tpl is None:
        # Without a verified accent template the strongest position is taken as beat 1.
        return int(np.argmax(profile_by_number(strengths, cycle_len, 0))), None
    scores = [correlation(profile_by_number(strengths, cycle_len, p), tpl) for p in range(cycle_len)]
    best = int(np.argmax(scores))
    return best, scores[best]


def first_start(first_beat: int, cycle_len: int, count_start: int) -> int:
    return (first_beat + count_start - 1) % cycle_len


def spans_from_starts(starts: list[int], n_beats: int, cycle_len: int) -> list[tuple[int, int]]:
    spans = []
    for i, s in enumerate(starts):
        nxt = starts[i + 1] if i + 1 < len(starts) else n_beats
        stop = min(nxt, s + cycle_len, n_beats)
        if stop - s >= 2:
            spans.append((s, stop))
    return spans


def build_cycles(
    beat_times: np.ndarray,
    strengths: np.ndarray,
    spans: list[tuple[int, int]],
    cycle_len: int,
    order: list[int],
    accents,
    no_compas: list[list[float]] = (),
) -> dict:
    tpl = template(cycle_len, accents, order)
    med_ibi = float(np.median(np.diff(beat_times)))
    rows = np.full((len(spans), cycle_len), np.nan)
    for i, (a, b) in enumerate(spans):
        rows[i, : b - a] = strengths[a:b]

    cycles = []
    for i, (a, b) in enumerate(spans):
        times = beat_times[a:b]
        end = float(beat_times[b]) if b < len(beat_times) else float(times[-1] + med_ibi)
        ibi = np.diff(np.append(times, end))
        regularity = max(0.0, 1.0 - 5.0 * float(np.std(ibi) / np.mean(ibi)))
        cycle = {
            "index": i,
            "start": float(times[0]),
            "end": end,
            "beat_times": [round(float(t), 4) for t in times],
            "partial": b - a != cycle_len,
            "tempo_bpm": round(60.0 / float(np.mean(ibi)), 1),
            "template_corr": None,
            "suggested_shift": 0,
            "no_compas": any(t0 < end and t1 > times[0] for t0, t1 in no_compas),
        }
        confidence = regularity
        if tpl is not None:
            local = np.nanmean(rows[max(0, i - LOCAL_WINDOW) : i + LOCAL_WINDOW + 1], axis=0)
            here = correlation(local, tpl)
            shifted = [correlation(np.roll(local, -r), tpl) for r in range(cycle_len)]
            best = int(np.argmax(shifted))
            if best and shifted[best] - here > 0.25:
                cycle["suggested_shift"] = best if best <= cycle_len // 2 else best - cycle_len
            cycle["template_corr"] = round(here, 3)
            confidence = max(0.0, here) * regularity
        cycle["confidence"] = round(confidence, 3)
        cycle["low_confidence"] = confidence < LOW_CONFIDENCE or cycle["no_compas"]
        cycles.append(cycle)

    full = rows[[not c["partial"] and not c["no_compas"] for c in cycles]]
    profile = np.nanmean(full, axis=0) if len(full) else np.full(cycle_len, np.nan)
    return {
        "cycles": cycles,
        "profile": [None if np.isnan(v) else round(float(v), 4) for v in profile],
        "profile_corr": None if tpl is None or not len(full) else round(correlation(profile, tpl), 3),
    }
