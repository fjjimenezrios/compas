import logging
import shutil
import subprocess
import sys
from pathlib import Path

import torch

log = logging.getLogger(__name__)

DEFAULT_MODEL = "htdemucs_6s"
# htdemucs_6s's piano stem is mostly bleed from the guitar in flamenco recordings.
DISCARDED_STEMS = {"piano"}


def separate(wav: Path, stems_dir: Path, work_dir: Path, model: str = DEFAULT_MODEL) -> list[Path]:
    devices = ["mps", "cpu"] if torch.backends.mps.is_available() else ["cpu"]
    for device in devices:
        cmd = [sys.executable, "-m", "demucs", "-n", model, "--mp3", "--mp3-bitrate", "128", "-d", device, "-o", str(work_dir), str(wav)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            break
        log.warning("demucs falló en %s, probando el siguiente dispositivo: %s", device, result.stderr[-500:])
    else:
        raise RuntimeError(f"demucs falló: {result.stderr[-2000:]}")

    stems_dir.mkdir(parents=True, exist_ok=True)
    produced = work_dir / model / wav.stem
    stems = []
    for mp3 in sorted(produced.glob("*.mp3")):
        if mp3.stem in DISCARDED_STEMS:
            continue
        dst = stems_dir / mp3.name
        shutil.move(mp3, dst)
        stems.append(dst)
    return stems
