import numpy as np


def palma(sr: int, rng: np.random.Generator, length_s: float = 0.06) -> np.ndarray:
    n = int(length_s * sr)
    burst = np.diff(rng.standard_normal(n + 1))  # differentiated noise ≈ bright clap
    return burst * np.exp(-np.arange(n) / (0.012 * sr))


def compas(
    bpm: float = 220.0,
    cycles: int = 16,
    cycle_len: int = 12,
    accents=(3, 6, 8, 10, 12),
    first_number: int = 12,
    offset_s: float = 0.5,
    sr: int = 22050,
    seed: int = 0,
) -> tuple[np.ndarray, np.ndarray, list[int]]:
    """Returns (audio, beat times, beat numbers). `first_number` is the count of the first clap."""
    rng = np.random.default_rng(seed)
    ibi = 60.0 / bpm
    n_beats = cycles * cycle_len
    times = offset_s + np.arange(n_beats) * ibi
    numbers = [((first_number - 1 + k) % cycle_len) + 1 for k in range(n_beats)]
    y = 0.003 * rng.standard_normal(int((times[-1] + 1.0) * sr))
    for t, num in zip(times, numbers):
        hit = palma(sr, rng) * (1.0 if num in accents else 0.3)
        i = int(t * sr)
        y[i : i + len(hit)] += hit[: len(y) - i]
    return (y / np.abs(y).max() * 0.9).astype(np.float32), times, numbers
