import json
import logging
import re
import shutil
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from flamenco_study import beats, cycles, onsets, overrides
from flamenco_study.decode import ANALYSIS_SR, load_mono, to_wav
from flamenco_study.separate import DEFAULT_MODEL, separate
from flamenco_study.sections import detect_sections

log = logging.getLogger(__name__)

AUDIO_SUFFIXES = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".aac"}
# Below this energy ratio the drums stem is treated as silent (no percussion in the recording).
MIN_PERCUSSION_RATIO = 0.05


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def zscore(x: np.ndarray) -> np.ndarray:
    std = x.std()
    return (x - x.mean()) / std if std else np.zeros_like(x)


def analyze_rhythm(mix: np.ndarray, percussion: np.ndarray, sr: int, palo: dict) -> tuple[dict, dict]:
    envelope = beats.onset_envelope(percussion, sr)

    def strength(times):
        return beats.strength_at(envelope, sr, times)

    tempo_range = palo.get("tempo_bpm")
    detected = {"beat_this:mix": beats.beat_this(mix, sr), "beat_this:percusion": beats.beat_this(percussion, sr)}
    candidates = {name: beats.fit_tempo_range(b, tempo_range, strength) for name, (b, _) in detected.items()}
    _, seed, _ = beats.choose(candidates)
    candidates["librosa:percusion"] = beats.fit_tempo_range(
        beats.tracked_beats(envelope, sr, beats.bpm_of(seed)), tempo_range, strength
    )
    source, beat_times, scores = beats.choose(candidates)
    beat_times = beats.fill_gaps(beat_times)

    n = palo["cycle_len"]
    z = zscore(strength(beat_times))
    first_beat, phase_corr = cycles.find_first_beat(z, n, palo.get("accents"))
    order = cycles.display_order(n, palo["count_start"])
    first_start = cycles.first_start(first_beat, n, palo["count_start"])
    spans = cycles.spans_from_starts(list(range(first_start, len(beat_times), n)), len(beat_times), n)
    built = cycles.build_cycles(beat_times, z, spans, n, order, palo.get("accents"))

    beats_json = {
        "source": source,
        "beats": [round(float(t), 4) for t in beat_times],
        "downbeats_model": [round(float(t), 4) for t in detected.get(source, (None, []))[1]],
        "stability": {k: round(v, 4) for k, v in scores.items()},
        "tempo_bpm": round(beats.bpm_of(beat_times), 1),
    }
    grid = {
        "palo": palo["id"],
        "cycle_len": n,
        "count_start": palo["count_start"],
        "order": order,
        "accents": palo.get("accents"),
        "subdivision": palo.get("subdivision", 2),
        "first_start": first_start,
        "phase_corr": None if phase_corr is None else round(phase_corr, 3),
        "beats": beats_json["beats"],
        "beat_strength": [round(float(v), 3) for v in z],
        **built,
    }
    return beats_json, grid


def layer_files(song_dir: Path) -> dict[str, Path]:
    layers = {p.stem: p for p in sorted((song_dir / "stems").glob("*")) if p.suffix in AUDIO_SUFFIXES}
    original = next((p for p in (song_dir / "audio").glob("original.*")), None)
    if original:
        layers["original"] = original
    return layers


def analyze_layers(song_dir: Path, grid: dict) -> list[str]:
    beat_times = np.asarray(grid["beats"])
    spans = cycles.spans_from_starts(
        list(range(grid["first_start"], len(beat_times), grid["cycle_len"])), len(beat_times), grid["cycle_len"]
    )
    names = []
    for name, path in layer_files(song_dir).items():
        y = load_mono(path)
        times, strengths = onsets.detect(y, ANALYSIS_SR)
        assigned = onsets.assign(times, strengths, beat_times, spans, grid["order"], grid["subdivision"])
        write_json(song_dir / "analysis" / f"onsets-{name}.json", assigned)
        write_json(song_dir / "analysis" / f"peaks-{name}.json", onsets.peaks(y, ANALYSIS_SR))
        names.append(name)
    return names


def analyze_sections(song_dir: Path) -> list[dict]:
    stems = song_dir / "stems"
    vocals = next((p for p in stems.glob("vocals.*")), None)
    if vocals is None:
        sections: list[dict] = []
    else:
        sections = detect_sections(vocals, next((p for p in stems.glob("guitar.*")), None))
    write_json(song_dir / "analysis" / "sections.json", sections)
    return sections


def analyze(
    audio: Path,
    palo: dict,
    out_dir: Path,
    model: str = DEFAULT_MODEL,
    title: str | None = None,
    artist: str | None = None,
) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audio").mkdir(exist_ok=True)
    for old in (out_dir / "audio").glob("original.*"):
        old.unlink()
    shutil.copy2(audio, out_dir / "audio" / f"original{audio.suffix.lower()}")

    with tempfile.TemporaryDirectory() as tmp:
        log.info("1/5 Decodificando %s", audio.name)
        wav = to_wav(audio, Path(tmp) / "mix.wav")
        log.info("2/5 Separando capas con demucs (%s)", model)
        shutil.rmtree(out_dir / "stems", ignore_errors=True)
        separate(wav, out_dir / "stems", Path(tmp), model)
        mix = load_mono(wav)

    drums_path = out_dir / "stems" / "drums.mp3"
    drums = load_mono(drums_path) if drums_path.exists() else np.zeros(1)
    has_percussion = np.sqrt(np.mean(drums**2)) > MIN_PERCUSSION_RATIO * np.sqrt(np.mean(mix**2))
    percussion = drums[: len(mix)] if has_percussion else mix

    log.info("3/5 Buscando pulsos y compás (%s)", palo["name"])
    beats_json, grid = analyze_rhythm(mix, percussion, ANALYSIS_SR, palo)
    grid["strength_source"] = "drums" if has_percussion else "mix"
    write_json(out_dir / "analysis" / "beats.json", beats_json)
    write_json(out_dir / "analysis" / "grid.json", grid)

    log.info("4/5 Detectando ataques y secciones")
    layers = analyze_layers(out_dir, grid)

    analyze_sections(out_dir)

    log.info("5/5 Guardando meta.json")
    meta_path = out_dir / "meta.json"
    previous = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    full = [c for c in grid["cycles"] if not c["partial"]]
    meta = {
        "title": title or previous.get("title") or audio.stem,
        "artist": artist or previous.get("artist") or "",
        "palo": palo["id"],
        "palo_name": palo["name"],
        "tempo_bpm": round(float(np.median([c["tempo_bpm"] for c in full])), 1) if full else beats_json["tempo_bpm"],
        "cycle_len": grid["cycle_len"],
        "count_start": grid["count_start"],
        "cycles": len(full),
        "profile_corr": grid["profile_corr"],
        "low_confidence_cycles": sum(c["low_confidence"] for c in grid["cycles"]),
        "beat_source": beats_json["source"],
        "model": model,
        "layers": layers,
        "source_file": audio.name,
        "analyzed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notes": previous.get("notes", ""),
    }
    write_json(meta_path, meta)
    overrides_path = out_dir / "user" / "overrides.json"
    if not overrides_path.exists():
        overrides.save(overrides_path, overrides.default())
    return meta
