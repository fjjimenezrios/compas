import json
import re
from pathlib import Path

from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from flamenco_study import ESTUDIO_DIR, SONGS_DIR, WEB_DIST, overrides
from flamenco_study.palos import list_palos
from flamenco_study.pipeline import layer_files

SLUG = re.compile(r"^[a-z0-9_-]+$")


def song_dir(songs_dir: Path, slug: str) -> Path:
    path = songs_dir / slug
    if not SLUG.match(slug) or not (path / "meta.json").exists():
        raise HTTPException(404, "Canción no encontrada")
    return path


def create_app(songs_dir: Path = SONGS_DIR, web_dist: Path = WEB_DIST, estudio_dir: Path = ESTUDIO_DIR) -> Starlette:
    async def songs(request: Request):
        metas = [
            {"slug": d.name, **json.loads((d / "meta.json").read_text())}
            for d in sorted(songs_dir.iterdir())
            if (d / "meta.json").exists()
        ]
        return JSONResponse(sorted(metas, key=lambda m: m["title"].lower()))

    async def song(request: Request):
        slug = request.path_params["slug"]
        d = song_dir(songs_dir, slug)
        layers = {name: str(path.relative_to(d)) for name, path in layer_files(d).items()}
        return JSONResponse({
            "slug": slug,
            "meta": json.loads((d / "meta.json").read_text()),
            "layers": layers,
            "overrides": overrides.load(d / "user" / "overrides.json"),
        })

    async def put_overrides(request: Request):
        d = song_dir(songs_dir, request.path_params["slug"])
        try:
            data = overrides.normalize(await request.json())
        except (ValueError, json.JSONDecodeError) as exc:
            return JSONResponse({"error": str(exc)}, status_code=400)
        overrides.save(d / "user" / "overrides.json", data)
        return JSONResponse(data)

    async def palos(request: Request):
        return JSONResponse(list_palos())

    routes = [
        Route("/api/songs", songs),
        Route("/api/songs/{slug}", song),
        Route("/api/songs/{slug}/overrides", put_overrides, methods=["PUT"]),
        Route("/api/palos", palos),
        Mount("/songs", StaticFiles(directory=songs_dir, check_dir=False)),
        Mount("/estudio", StaticFiles(directory=estudio_dir, check_dir=False)),
    ]
    if web_dist.exists():
        routes.append(Mount("/", StaticFiles(directory=web_dist, html=True)))
    return Starlette(routes=routes, middleware=[Middleware(RevalidateMiddleware)])


class RevalidateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Hashed assets can be cached; the page and analysis JSON change on every rebuild/reanalysis.
        if not request.url.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "no-cache"
        return response
