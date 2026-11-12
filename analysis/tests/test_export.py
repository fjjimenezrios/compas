import json

import pytest

from flamenco_study.export import export_static as _export


def export_static(out, songs, slugs=None, estudio=None):
    kwargs = {"estudio_dir": estudio} if estudio else {}
    return _export(out, songs, slugs, compress=compressed.append, **kwargs)


compressed = []


def make_song(songs_dir, slug):
    d = songs_dir / slug
    (d / "audio").mkdir(parents=True)
    (d / "stems").mkdir()
    (d / "user").mkdir()
    (d / "meta.json").write_text(json.dumps({"title": slug.title(), "palo": "bulerias"}))
    (d / "audio" / "original.mp3").write_bytes(b"x")
    (d / "stems" / "drums.mp3").write_bytes(b"x")
    (d / "user" / "overrides.json").write_text('{"notes": "privado"}')


@pytest.fixture
def dirs(tmp_path):
    songs, out = tmp_path / "songs", tmp_path / "out"
    out.mkdir()
    (out / "index.html").write_text("<html></html>")
    make_song(songs, "publica")
    make_song(songs, "privada")
    return songs, out


def test_all_songs_are_exported_by_default(dirs):
    songs, out = dirs
    compressed.clear()
    assert export_static(out, songs) == ["privada", "publica"]
    assert len(compressed) == 4  # original + drums for each song
    assert {m["slug"] for m in json.loads((out / "api" / "songs.json").read_text())} == {"privada", "publica"}


def test_only_requested_songs_are_exported_and_private_data_is_left_out(dirs):
    songs, out = dirs
    (songs / "publica" / "meta.json").write_text(json.dumps({"title": "Publica", "notes": "mis notas"}))
    export_static(out, songs, ["publica"])

    assert json.loads((out / "api" / "songs.json").read_text())[0]["slug"] == "publica"
    assert (out / ".nojekyll").exists()
    assert not (out / "songs" / "privada").exists()
    assert (out / "songs" / "publica" / "stems" / "drums.mp3").exists()
    assert not (out / "songs" / "publica" / "user").exists()
    detail = json.loads((out / "api" / "songs" / "publica.json").read_text())
    assert set(detail["layers"]) == {"drums", "original"}
    assert detail["overrides"]["notes"] == ""
    assert detail["meta"]["notes"] == ""
    assert json.loads((out / "songs" / "publica" / "meta.json").read_text())["notes"] == ""


def test_reexport_drops_songs_no_longer_listed(dirs):
    songs, out = dirs
    export_static(out, songs, ["publica", "privada"])
    export_static(out, songs, ["publica"])
    assert not (out / "songs" / "privada").exists()
    assert not (out / "api" / "songs" / "privada.json").exists()


def test_fails_without_built_web_or_unknown_song(dirs, tmp_path):
    songs, out = dirs
    with pytest.raises(SystemExit):
        export_static(tmp_path / "vacio", songs, ["publica"])
    with pytest.raises(SystemExit):
        export_static(out, songs, ["no-existe"])


def test_study_guides_are_published_and_refreshed(dirs, tmp_path):
    songs, out = dirs
    estudio = tmp_path / "estudio"
    estudio.mkdir()
    (estudio / "bulerias.md").write_text("## Qué es\n")
    export_static(out, songs, estudio=estudio)
    assert (out / "estudio" / "bulerias.md").read_text() == "## Qué es\n"

    (estudio / "bulerias.md").unlink()
    export_static(out, songs, estudio=estudio)
    assert not (out / "estudio" / "bulerias.md").exists()
