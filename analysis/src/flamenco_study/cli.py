import argparse
import json
import logging
import tempfile
import webbrowser
from pathlib import Path

import soundfile as sf
import uvicorn

from flamenco_study import SONGS_DIR, STATIC_DIST, export, pipeline, synth
from flamenco_study.palos import load_palo
from flamenco_study.separate import DEFAULT_MODEL
from flamenco_study.server import create_app

log = logging.getLogger("flamenco_study")

SYNTHETIC_SLUG = "_synthetic-bulerias"


def cmd_analyze(args) -> None:
    audio = Path(args.audio).expanduser().resolve()
    if not audio.exists():
        raise SystemExit(f"No existe el audio: {audio}")
    palo = load_palo(args.palo)
    out = Path(args.out) if args.out else SONGS_DIR / pipeline.slugify(args.title or audio.stem)
    meta = pipeline.analyze(audio, palo, out, model=args.model, title=args.title, artist=args.artist)
    log.info("Listo: %s", out)
    log.info(json.dumps({k: meta[k] for k in ("tempo_bpm", "cycles", "profile_corr", "low_confidence_cycles")}))


def cmd_onsets(args) -> None:
    song_dir = Path(args.song_dir)
    grid = json.loads((song_dir / "analysis" / "grid.json").read_text())
    layers = pipeline.analyze_layers(song_dir, grid)
    meta_path = song_dir / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["layers"] = layers
    pipeline.write_json(meta_path, meta)
    log.info("Capas analizadas: %s", ", ".join(layers))


def cmd_sections(args) -> None:
    dirs = [Path(d) for d in args.song_dir] or sorted(d for d in SONGS_DIR.iterdir() if (d / "meta.json").exists())
    for d in dirs:
        sections = pipeline.analyze_sections(d)
        singing = sum(s["end"] - s["start"] for s in sections if s["kind"] == "cante")
        log.info("%s: %d secciones, %.0f s de cante", d.name, len(sections), singing)


def cmd_synth(args) -> None:
    palo = load_palo("bulerias")
    y, _, _ = synth.compas(sr=44100)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "palmas-sinteticas.wav"
        sf.write(wav, y, 44100)
        pipeline.analyze(wav, palo, SONGS_DIR / SYNTHETIC_SLUG, title="Palmas sintéticas (bulería)", artist="Test")
    log.info("Generada %s", SONGS_DIR / SYNTHETIC_SLUG)


def cmd_export(args) -> None:
    slugs = export.export_static(slugs=args.only)
    log.info("Exportadas %d canción(es) a %s: %s", len(slugs), STATIC_DIST, ", ".join(slugs))


def cmd_serve(args) -> None:
    url = f"http://localhost:{args.port}"
    if args.open:
        webbrowser.open(url)
    uvicorn.run(create_app(), host="127.0.0.1", port=args.port, log_level="warning")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(prog="flamenco-study")
    sub = parser.add_subparsers(required=True)

    p = sub.add_parser("analyze", help="Analiza una canción y crea su carpeta en songs/")
    p.add_argument("audio")
    p.add_argument("--palo", required=True)
    p.add_argument("--out")
    p.add_argument("--title")
    p.add_argument("--artist")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.set_defaults(func=cmd_analyze)

    p = sub.add_parser("onsets", help="Recalcula ataques y formas de onda (p. ej. tras añadir un stem a mano)")
    p.add_argument("song_dir")
    p.set_defaults(func=cmd_onsets)

    p = sub.add_parser("sections", help="Detecta cante y toque de una canción (todas si no se indica ninguna)")
    p.add_argument("song_dir", nargs="*")
    p.set_defaults(func=cmd_sections)

    p = sub.add_parser("synth", help="Genera y analiza la canción sintética de prueba")
    p.set_defaults(func=cmd_synth)

    p = sub.add_parser("export-static", help="Prepara web/dist-static para subir a Vercel con todas las canciones")
    p.add_argument("--only", action="append", metavar="SLUG", help="publicar solo estas canciones; repetible")
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("serve", help="Arranca la web en localhost")
    p.add_argument("--port", type=int, default=8766)
    p.add_argument("--open", action="store_true")
    p.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    args.func(args)
