from collections import Counter

import numpy as np
import pytest

from flamenco_study import beats, cycles, onsets, synth
from flamenco_study.palos import load_palo
from flamenco_study.pipeline import analyze_rhythm

SR = 22050


@pytest.fixture(scope="module")
def bulerias():
    return load_palo("bulerias")


@pytest.mark.parametrize("first_number", [12, 7])
def test_synthetic_bulerias_phase_and_onsets(bulerias, first_number):
    y, true_times, true_numbers = synth.compas(bpm=220, cycles=14, first_number=first_number, sr=SR)
    _, grid = analyze_rhythm(y, y, SR, bulerias)

    assert grid["profile_corr"] > 0.9
    first_cycle = grid["cycles"][0]
    # the first cycle must start on a true "12" (count_start of bulerías)
    twelves = true_times[[n == 12 for n in true_numbers]]
    assert np.min(np.abs(twelves - first_cycle["start"])) < 0.03

    beat_times = np.asarray(grid["beats"])
    spans = cycles.spans_from_starts(
        list(range(grid["first_start"], len(beat_times), 12)), len(beat_times), 12
    )
    times, strengths = onsets.detect(y, SR)
    assigned = [o for o in onsets.assign(times, strengths, beat_times, spans, grid["order"], 2) if o["beat"]]
    truth = dict(zip(np.round(true_times, 2), true_numbers))
    hits = Counter()
    for o in assigned:
        nearest = min(truth, key=lambda t: abs(t - o["t"]))
        hits[abs(nearest - o["t"]) < 0.05 and truth[nearest] == o["beat"] and o["sub"] == 0] += 1
    assert hits[True] / sum(hits.values()) >= 0.95


def test_find_first_beat_with_noise():
    rng = np.random.default_rng(1)
    accents = [3, 6, 8, 10, 12]
    numbers = [((4 + k) % 12) + 1 for k in range(12 * 10)]  # starts on beat 5
    strengths = np.array([1.0 if n in accents else 0.0 for n in numbers]) + 0.3 * rng.standard_normal(len(numbers))
    first_beat, corr = cycles.find_first_beat(strengths, 12, accents)
    assert numbers[first_beat] == 1
    assert corr > 0.8


def test_fill_gaps_restores_missing_beat():
    rng = np.random.default_rng(2)
    full = 0.3 + np.arange(40) * 0.27 + rng.normal(0, 0.004, 40)
    with_gap = np.delete(full, [10, 25, 26])
    filled = beats.fill_gaps(with_gap)
    assert len(filled) == len(full)
    assert np.max(np.abs(filled - full)) < 0.02


def test_fit_tempo_range_doubles_and_halves():
    slow = np.arange(0, 20, 60 / 110)
    assert 200 < beats.bpm_of(beats.fit_tempo_range(slow, [170, 280], lambda t: np.ones(len(t)))) < 240

    fast = np.arange(0, 20, 60 / 440)
    strong_odd = lambda t: np.array([1.0 if round(x / (60 / 440)) % 2 else 0.0 for x in t])
    halved = beats.fit_tempo_range(fast, [170, 280], strong_odd)
    assert 200 < beats.bpm_of(halved) < 240
    assert strong_odd(halved).all()


def test_template_free_palo_uses_strongest_beat():
    strengths = np.tile([0.1, 0.2, 1.0, 0.1], 10)
    first_beat, corr = cycles.find_first_beat(strengths, 4, None)
    assert first_beat == 2 and corr is None
