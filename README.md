# Compás

App local para coger el compás de canciones flamencas: en qué tiempos del ciclo caen las palmas, la guitarra y el cante, con qué fuerza y cómo cambia a lo largo de la canción.

- `analysis/`: pipeline en Python (demucs → Beat This!/librosa → ciclos → ataques por capa) y servidor local.
- `web/`: interfaz React + Vite.
- `palos/`: definición de cada palo (datos, no código): ciclo, acentos y formas de acentuación para el metrónomo.
- `estudio/<palo>.md`: guía de estudio de cada palo, con fuentes. Se ve en la sección Documentación.
- `songs/<slug>/`: una carpeta por canción (ignorada por git salvo `_synthetic-bulerias`).

## Instalación

```bash
brew install ffmpeg uv
cd analysis && uv sync && cd ..
npm --prefix web install && npm --prefix web run build
```

## Uso

```bash
uv run --project analysis flamenco-study serve          # http://localhost:8766
```

Para añadir una canción, pídeselo a Claude Code ("analiza esta canción, es una bulería"): usa la skill `analizar-cancion`. A mano:

```bash
uv run --project analysis flamenco-study analyze "cancion.mp3" --palo bulerias --title "Título" --artist "Artista"
```

Si añades un stem propio (p. ej. `songs/<slug>/stems/guitarra.mp3`): `flamenco-study onsets songs/<slug>`.

Tus correcciones viven en `songs/<slug>/user/overrides.json` y nunca se pisan al reanalizar.

## Añadir un palo

Crea `palos/<id>.json`:

```json
{
  "name": "Bulerías",
  "family": "12 tiempos",
  "cycle_len": 12,
  "accents": [3, 6, 8, 10, 12],
  "count_start": 12,
  "subdivision": 2,
  "tempo_bpm": [170, 280],
  "status": "verified",
  "sources": ["https://…"]
}
```

`accents` y `tempo_bpm` solo con fuentes. Sin ellas, `accents: null` y `status: "TODO"`: el análisis toma el tiempo más fuerte como 1 y avisa.

## Límites

La detección de pulso no está validada en flamenco. Falla con rubato, cante libre y palmas que se solapan con la guitarra. La capa de percusión mezcla palmas, cajón y taconeo. La web raya los compases de baja confianza.

## Tests

```bash
cd analysis && uv run pytest
npm --prefix web test
```

## Publicar en GitHub Pages

El análisis (demucs, Beat This!) se hace en local. A Pages se sube solo la web compilada con las canciones, sus capas y las guías de `estudio/`. Todo lo exportado queda accesible por URL.

Una sola vez, con la cuenta `fjjimenezrios` de `gh` (comprueba con `gh auth status`):

```bash
gh repo create compas --public --source=. --remote=origin   # crea el repo y añade origin
git config --local user.email "fjjimenezrios@gmail.com"      # ya configurado en este repo
```

Cada vez que quieras publicar:

```bash
npm --prefix web run build:static
uv run --project analysis flamenco-study export-static            # todas las canciones; --only <slug> para elegir
scripts/publish-pages.sh "chore: publish site"                    # sube web/dist-static a la rama gh-pages
```

La primera vez, activa Pages sobre esa rama (Settings → Pages → Deploy from a branch → `gh-pages` / root) o con
`gh api -X POST repos/fjjimenezrios/compas/pages -f "source[branch]=gh-pages" -f "source[path]=/"`.
La web queda en `https://fjjimenezrios.github.io/compas/`.

Límites de Pages: 1 GB por sitio y unos 100 GB de tráfico al mes. `songs/<slug>/user/` y las notas de `meta.json` nunca se exportan.

