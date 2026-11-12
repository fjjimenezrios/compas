import json
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path

from flamenco_study import ESTUDIO_DIR, SONGS_DIR, STATIC_DIST, overrides
from flamenco_study.palos import list_palos
from flamenco_study.pipeline import layer_files

def compress_mp3(path: Path, bitrate: str = "128k") -> None:
    tmp = path.with_name(f"{path.stem}.tmp.mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-vn", "-b:a", bitrate, str(tmp)], check=True)
    # Already-small files must not grow by re-encoding.
    if tmp.stat().st_size < path.stat().st_size:
        tmp.replace(path)
    else:
        tmp.unlink()


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def export_static(out: Path = STATIC_DIST, songs_dir: Path = SONGS_DIR, slugs: list[str] | None = None,
                  compress: Callable[[Path], None] = compress_mp3, estudio_dir: Path = ESTUDIO_DIR) -> list[str]:
    if not (out / "index.html").exists():
        raise SystemExit("Falta la web compilada: ejecuta antes `npm --prefix web run build:static`.")
    if slugs is None:
        slugs = sorted(d.name for d in songs_dir.iterdir() if (d / "meta.json").exists())
    missing = [s for s in slugs if not (songs_dir / s / "meta.json").exists()]
    if missing:
        raise SystemExit(f"No existen en songs/: {', '.join(missing)}")

    # Start from a clean slate so a song dropped from the list can't linger in the deployed folder.
    for stale in ("api", "songs", "estudio"):
        shutil.rmtree(out / stale, ignore_errors=True)

    metas = []
    for slug in slugs:
        src = songs_dir / slug
        # The owner's private notes live in meta.json; they stay local like user/.
        meta = {**json.loads((src / "meta.json").read_text()), "notes": ""}
        layers = {name: str(path.relative_to(src)) for name, path in layer_files(src).items()}
        # user/ (the owner's overrides and notes) is never published.
        shutil.copytree(src, out / "songs" / slug, ignore=shutil.ignore_patterns("user"))
        write_json(out / "songs" / slug / "meta.json", meta)
        for mp3 in (out / "songs" / slug).glob("*/*.mp3"):
            compress(mp3)
        write_json(out / "api" / "songs" / f"{slug}.json", {
            "slug": slug, "meta": meta, "layers": layers, "overrides": overrides.default(),
        })
        metas.append({"slug": slug, **meta})

    if estudio_dir.exists():
        shutil.copytree(estudio_dir, out / "estudio")
    write_json(out / "api" / "songs.json", sorted(metas, key=lambda m: m["title"].lower()))
    write_json(out / "api" / "palos.json", list_palos())
    # Without this, GitHub Pages (Jekyll) skips folders starting with "_", e.g. songs/_synthetic-bulerias.
    (out / ".nojekyll").touch()
    return slugs
