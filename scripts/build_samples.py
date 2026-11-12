"""
Builds the palmas and cajón one-shots in web/public/samples/ from CC-licensed recordings.

Sources (download each into its own folder and pass the folders as arguments):

  palmas  CC0 1.0, Santiago Sánchez Cifuentes, Wikimedia Commons
          "Palmas sevillanas (flamenco clapping), 160 BPM.ogg" -> sevillanas160.ogg
          https://commons.wikimedia.org/wiki/File:Palmas_sevillanas_(flamenco_clapping),_160_BPM.ogg
  cajón   CC BY 4.0, OldBassMan, Freesound, pack "Cajon" (sounds 151030-151054), saved as <id>.mp3
          https://freesound.org/people/OldBassMan/packs/9321/

Run with an isolated interpreter and never from inside the download folders:

  analysis/.venv/bin/python -I scripts/build_samples.py --palmas DIR --cajon DIR --out web/public/samples
"""

import argparse
import json
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

SR = 44100
PRE_ROLL_S = 0.003
SPACING_S = 5.0  # picked palmas come from different moments, so the variants don't share a phrase

# Freesound id -> original file name; "PK-M" = bass, "SN_" = the cajón's snare/slap.
CAJON = {
    151030: "PK-M1.8", 151031: "PK-M4.6", 151032: "PK-M3.9", 151033: "PK-M3.5", 151034: "PK-M3.3",
    151035: "PK-M5.6", 151036: "PK-M4.7", 151037: "PK-M6.1", 151038: "SN_L-4.2", 151039: "SN_L-16.2",
    151040: "SN_L-15.2", 151041: "SN_L-11.2", 151042: "SN_L-7.1", 151043: "SN_L-6.7", 151044: "SN_L-6.1",
    151045: "SN_L-5.9", 151046: "SN_R-11.5", 151047: "SN_L-8.6", 151048: "SN_R-3.2", 151049: "SN_R-2.8",
    151050: "SN_R-9.2.5", 151051: "SN_R-3.3", 151052: "SN_R-4.2", 151053: "SN_R-4.7", 151054: "SN_R-3.6",
}
PALMAS_SOURCE = "https://commons.wikimedia.org/wiki/File:Palmas_sevillanas_(flamenco_clapping),_160_BPM.ogg"


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-9))


def fade_out(y: np.ndarray, seconds: float) -> np.ndarray:
    n = min(len(y), int(seconds * SR))
    y = y.copy()
    y[-n:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, n)))
    return y


def finish(segment: np.ndarray, peak_target: float, tail_s: float) -> np.ndarray:
    segment = segment.copy()
    ramp = int(0.001 * SR)
    segment[:ramp] *= np.linspace(0, 1, ramp)
    segment = fade_out(segment, tail_s)
    return segment * (peak_target / np.abs(segment).max())


def onset_ms(y: np.ndarray) -> float:
    """Time of the first sample above 10 % of the peak: the hit must start right at 0."""
    return float(np.argmax(np.abs(y) >= 0.1 * np.abs(y).max())) * 1000 / SR


# ---- cajón: isolated hits recorded at several velocities --------------------------------

def load_cajon(folder: Path):
    hits = {}
    for sid, name in CAJON.items():
        y, _ = librosa.load(folder / f"{sid}.mp3", sr=SR, mono=True)
        peak = np.abs(y).max()
        start = int(np.argmax(np.abs(y) >= 0.1 * peak))
        start = max(0, start - int(PRE_ROLL_S * SR))
        hits[sid] = dict(name=name, y=y[start:start + int(0.6 * SR)], peak=float(peak))
    return hits


def pick_cajon(hits):
    bass = sorted((s for s in hits if hits[s]["name"].startswith("PK")), key=lambda s: -hits[s]["peak"])
    slap = sorted((s for s in hits if hits[s]["name"].startswith("SN")), key=lambda s: -hits[s]["peak"])
    # alternate hands among the loudest slaps so the variants sound like two hands, not one
    left = [s for s in slap if "_L" in hits[s]["name"]]
    right = [s for s in slap if "_R" in hits[s]["name"]]
    loud_slaps = [left[0], right[0], left[1]]
    soft = [slap[-1], slap[-2], bass[-1]]
    return {
        "grave": (bass[:3], 0.80, 0.14),
        "agudo": (loud_slaps, 0.70, 0.07),
        "fantasma": (soft, 0.25, 0.05),
    }


# ---- palmas: single claps cut out of a loop ------------------------------------------------

def find_claps(path: Path):
    y, _ = librosa.load(path, sr=SR, mono=True)
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=128)
    times = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=128, units="time", backtrack=True)
    claps = []
    for i, t in enumerate(times):
        a = int(t * SR)
        seg = y[max(0, a - int(PRE_ROLL_S * SR)): a + int(0.30 * SR)]
        if len(seg) < int(0.25 * SR):
            continue
        peak = float(np.abs(seg).max())
        before = float(np.abs(y[max(0, a - int(0.05 * SR)): a]).max()) / peak
        tail = float(np.sqrt(np.mean(seg[int(0.18 * SR):int(0.28 * SR)] ** 2))) / peak
        gap = float(times[i + 1] - t) if i + 1 < len(times) else 9.0
        centroid = float(librosa.feature.spectral_centroid(y=seg[:int(0.06 * SR)], sr=SR, n_fft=1024, hop_length=1024)[0].mean())
        if before < 0.15 and tail < 0.25 and gap > 0.30 and peak < 0.98:
            claps.append(dict(t=float(t), y=seg[: int(0.25 * SR)], peak=peak, centroid=centroid))
    return claps


def spaced(candidates, count):
    chosen = []
    for c in candidates:
        if all(abs(c["t"] - o["t"]) >= SPACING_S for o in chosen):
            chosen.append(c)
        if len(chosen) == count:
            break
    return chosen


def pick_palmas(claps):
    by_peak = sorted(claps, key=lambda c: -c["peak"])
    strong = spaced(by_peak[: max(8, len(claps) // 5)], 4)
    # muffled claps: the darkest ones that are still clearly audible
    audible = [c for c in claps if c["peak"] >= np.median([k["peak"] for k in claps]) * 0.6]
    muted = spaced(sorted(audible, key=lambda c: c["centroid"]), 4)
    return strong, muted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--palmas", type=Path, required=True)
    ap.add_argument("--cajon", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, list[str]] = {}
    sources: dict[str, dict] = {}
    report = []

    def save(kind: str, filename: str, y: np.ndarray, source: dict):
        sf.write(args.out / filename, y.astype(np.float32), SR, subtype="PCM_16")
        manifest.setdefault(kind, []).append(filename)
        sources[filename] = source
        report.append((filename, f"{db(np.abs(y).max()):.1f} dBFS", f"{len(y) / SR * 1000:.0f} ms", f"arranca en {onset_ms(y):.1f} ms"))
        assert onset_ms(y) < 8, f"{filename}: the hit starts {onset_ms(y):.1f} ms late"

    claps = find_claps(next(args.palmas.glob("sevillanas160.ogg")))
    strong, muted = pick_palmas(claps)
    for n, c in enumerate(strong, 1):
        save("clap", f"palma-fuerte-{n}.wav", finish(c["y"], 0.85, 0.09),
             dict(kind="palma fuerte", author="Santiago Sánchez Cifuentes", license="CC0 1.0", url=PALMAS_SOURCE, at_s=round(c["t"], 2)))
    for n, c in enumerate(muted, 1):
        save("clapSoft", f"palma-sorda-{n}.wav", finish(c["y"], 0.35, 0.09),
             dict(kind="palma sorda", author="Santiago Sánchez Cifuentes", license="CC0 1.0", url=PALMAS_SOURCE, at_s=round(c["t"], 2)))

    hits = load_cajon(args.cajon)
    names = {"grave": ("bass", "cajon-grave", "cajón grave"), "agudo": ("slap", "cajon-agudo", "cajón agudo"), "fantasma": ("ghost", "cajon-fantasma", "cajón fantasma")}
    for key, (ids, peak, tail) in pick_cajon(hits).items():
        kind, base, label = names[key]
        for n, sid in enumerate(ids, 1):
            save(kind, f"{base}-{n}.wav", finish(hits[sid]["y"], peak, tail),
                 dict(kind=label, author="OldBassMan", license="CC BY 4.0", url=f"https://freesound.org/people/OldBassMan/sounds/{sid}/", original=f"{hits[sid]['name']}.wav"))

    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (args.out / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
    for row in report:
        print("  ".join(f"{c:<24}" for c in row))
    print(f"\n{len(report)} archivos en {args.out}")


if __name__ == "__main__":
    main()
