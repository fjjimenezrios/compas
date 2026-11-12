import subprocess
from pathlib import Path

import librosa
import numpy as np

ANALYSIS_SR = 22050


def to_wav(src: Path, dst: Path, sr: int = 44100) -> Path:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "2", "-ar", str(sr), str(dst)],
        check=True,
    )
    return dst


def load_mono(path: Path, sr: int = ANALYSIS_SR) -> np.ndarray:
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y
