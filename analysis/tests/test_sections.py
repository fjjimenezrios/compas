import numpy as np
import soundfile as sf

from flamenco_study.sections import detect_sections

SR = 11025


def stem(tmp_path, name, bursts, seconds=40, freq=220.0):
    t = np.arange(int(seconds * SR)) / SR
    y = 0.001 * np.random.default_rng(0).standard_normal(len(t))
    for start, end in bursts:
        m = (t >= start) & (t < end)
        y[m] += 0.3 * np.sin(2 * np.pi * freq * t[m])
    path = tmp_path / f"{name}.wav"
    sf.write(path, y.astype(np.float32), SR)
    return path


def near(section, start, end, kind, tol=0.8):
    return section["kind"] == kind and abs(section["start"] - start) <= tol and abs(section["end"] - end) <= tol


def test_splits_cante_from_solo_guitar(tmp_path):
    vocals = stem(tmp_path, "vocals", [(10, 20), (30, 38)])
    guitar = stem(tmp_path, "guitar", [(0, 30)], freq=330.0)
    sections = detect_sections(vocals, guitar)
    assert len(sections) == 5
    assert near(sections[0], 0, 10, "toque")
    assert near(sections[1], 10, 20, "cante")
    assert near(sections[2], 20, 30, "toque")
    assert near(sections[3], 30, 38, "cante")
    assert near(sections[4], 38, 40, "instrumental")  # the guitar has stopped too


def test_a_short_shout_is_not_a_section_of_cante(tmp_path):
    vocals = stem(tmp_path, "vocals", [(24, 25.2)])
    guitar = stem(tmp_path, "guitar", [(0, 40)], freq=330.0)
    assert [s["kind"] for s in detect_sections(vocals, guitar)] == ["toque"]


def test_nearby_phrases_join_into_one_section(tmp_path):
    vocals = stem(tmp_path, "vocals", [(5, 12), (13, 20)])  # a one-second breath between phrases
    sections = detect_sections(vocals, None)
    assert [s["kind"] for s in sections] == ["instrumental", "cante", "instrumental"]
    assert near(sections[1], 5, 20, "cante")


def test_a_song_without_voice_is_one_section(tmp_path):
    vocals = stem(tmp_path, "vocals", [])
    assert detect_sections(vocals, None) == [{"start": 0.0, "end": 40.0, "kind": "instrumental"}]


def test_missing_vocals_stem_gives_no_sections(tmp_path):
    assert detect_sections(tmp_path / "nope.wav", None) == []
