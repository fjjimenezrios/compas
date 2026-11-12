# Compás

App local para coger el compás de canciones flamencas: en qué tiempos del ciclo caen las palmas, la guitarra y el cante, con qué fuerza y cómo cambia a lo largo de la canción.

- `analysis/`: pipeline en Python (demucs → Beat This!/librosa → ciclos → ataques por capa) y servidor local.
- `web/`: interfaz React + Vite. Secciones: Biblioteca (canciones), Documentación (una guía por palo y el Test con preguntas de las guías), Metrónomo (modo reloj, con palmas, cajón, remate y subida gradual de tempo) y Acordes (biblioteca de acordes, cejilla y acordes flamencos; la lógica está en `web/src/chords.ts` y sus tests comprueban que cada digitación contiene las notas del acorde).
- `palos/`: definición de cada palo (datos, no código): ciclo, acentos y formas de acentuación para el metrónomo.
- `estudio/<palo>.md`: guía de estudio de cada palo, con fuentes. Se ve en la sección Documentación.
- `songs/<slug>/`: una carpeta por canción (ignorada por git salvo `_synthetic-bulerias`).

## Python

Todo el proyecto usa **Python 3.12**: está fijado en `.python-version` (raíz y `analysis/`) y en `requires-python = "==3.12.*"`. Ejecuta siempre con `uv run`, que crea y usa el entorno 3.12 de `analysis/`; el `python3` suelto del sistema (3.9 en macOS) no se usa.

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

El análisis también detecta cuándo canta y cuándo toca solo la guitarra (`analysis/sections.json`); para canciones analizadas antes: `flamenco-study sections`.

### En la ficha de una canción

- **Reproductor multipista:** marca varias capas para oírlas a la vez, con volumen por capa y velocidad 50–100 %.
- **Secciones y bucle:** cante y solo guitarra sobre la barra de tiempo; repite una sección o un tramo A–B.
- **Entrenador de palmas:** palmea con Espacio (o el botón) sobre los acentos y te dice cuánto vas adelantado o tarde en cada tiempo. El ajuste de latencia compensa el retraso de tu dispositivo.

### Palmas y cajón

El metrónomo usa grabaciones reales con licencia libre (palmas CC0 de Santiago Sánchez Cifuentes y cajón CC BY 4.0 de OldBassMan en Freesound), con varias variantes de cada golpe. Hay un interruptor para oír los sonidos sintetizados. Los créditos salen en el pie de la web; el detalle por archivo está en `web/public/samples/` (`README.md` y `sources.json`), junto con cómo regenerarlos o cambiarlos.

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

