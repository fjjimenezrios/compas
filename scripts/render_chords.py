"""Renders every chord voicing of the chord library as a nylon-guitar strum (web/public/chords/<frets>.mp3).

uv run --python 3.12 --with numpy python scripts/render_chords.py GeneralUser-GS.sf2 web/public/chords voicings.json
Where voicings.json comes from: npx vite-node scripts/list-voicings.ts > voicings.json
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

import meltysynth as ms

SAMPLE_RATE = 44100
OPEN_MIDI = [40, 45, 50, 55, 59, 64]
NYLON_GUITAR = 24
STRUM_SECONDS = 0.045
LENGTH_SECONDS = 3.0
FADE_SECONDS = 0.5

sf2, out_dir, voicings_file = sys.argv[1:4]
font = ms.SoundFont.from_file(sf2)
out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)


def render(frets: list[int | None]) -> np.ndarray:
    synth = ms.Synthesizer(font, ms.SynthesizerSettings(SAMPLE_RATE))
    synth.process_midi_message(0, 0xC0, NYLON_GUITAR, 0)
    total = int(LENGTH_SECONDS * SAMPLE_RATE)
    done = 0
    chunks = []
    for k, (open_note, fret) in enumerate((n, f) for n, f in zip(OPEN_MIDI, frets) if f is not None):
        upto = int(k * STRUM_SECONDS * SAMPLE_RATE)
        if upto > done:
            chunks.append(_block(synth, upto - done))
            done = upto
        synth.note_on(0, open_note + fret, 90)
    chunks.append(_block(synth, total - done))
    audio = np.concatenate(chunks)
    audio[-int(FADE_SECONDS * SAMPLE_RATE):] *= np.linspace(1, 0, int(FADE_SECONDS * SAMPLE_RATE))[:, None]
    return audio


def _block(synth, n: int) -> np.ndarray:
    left, right = ms.create_buffer(n), ms.create_buffer(n)
    synth.render(left, right)
    return np.stack([left, right], axis=1)


voicings = [[None if f == "x" else int(f) for f in key.split("-")] for key in json.load(open(voicings_file))]
renders = [(key, render(frets)) for key, frets in zip(json.load(open(voicings_file)), voicings)]
peak = max(np.abs(a).max() for _, a in renders)  # one shared gain, so loud chords stay louder than soft ones
for key, audio in renders:
    pcm = (audio / peak * 0.85 * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "2", "-i", "-",
         "-codec:a", "libmp3lame", "-q:a", "5", str(out / f"{key}.mp3")],
        input=pcm, check=True,
    )
print(f"{len(renders)} acordes en {out}")
