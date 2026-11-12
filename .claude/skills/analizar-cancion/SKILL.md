---
name: analizar-cancion
description: Añadir o reanalizar una canción en la app local "Compás" (flamenco-study) para estudiar su compás. Usar cuando el usuario diga "analiza esta canción", "añade esta bulería/rumba/…", "canción nueva", "reanaliza X", o pase un audio (mp3/wav/m4a) para estudiarlo.
---

# Analizar una canción en Compás

La app es una web local (`http://localhost:8766`). Las canciones se añaden **solo** por esta vía: Claude ejecuta el análisis y la canción aparece en la biblioteca.

## Pasos

1. **Audio y palo.** Localiza el fichero (ruta dada, arrastrado al chat o en la raíz del repo). El palo es el id de un fichero de `palos/` (`ls palos/`). Si el usuario no lo ha dicho, pregúntalo; no lo adivines por el audio.
   - Si el palo tiene `"status": "TODO"` o `cycle_len: null`, avisa: el análisis no lo admite o irá sin plantilla de acentos. No inventes acentos para desbloquearlo (ver "Palo nuevo").
2. **Título y artista** del usuario o del nombre del fichero, sin años ni basura (`"Alfileres de colores. Miguel Poveda. 2011.mp3"` → título `Alfileres de colores`, artista `Miguel Poveda`).
3. **Analiza** desde la raíz del repo (tarda ~1–2 min por canción; lánzalo en segundo plano si es largo):
   ```bash
   uv run --project analysis flamenco-study analyze "<audio>" --palo <palo> --title "<título>" --artist "<artista>"
   ```
   Crea `songs/<slug>/`. Reanalizar la misma canción reutiliza la carpeta y **nunca** toca `user/overrides.json`.
4. **Servidor.** Si `curl -sf localhost:8766/api/songs` falla, arranca `uv run --project analysis flamenco-study serve` en segundo plano. Si `web/dist` no existe, antes `npm --prefix web run build`.
5. **Resume en 3 líneas** leyendo `songs/<slug>/meta.json` y `analysis/grid.json`: tempo, `profile_corr` (parecido con la plantilla del palo) y compases de baja confianza. Si el parecido es bajo (< 0,7), dilo tal cual y sugiere mirar las capas en la web: puede ser que las palmas marquen distinto que la guitarra, o que el palo indicado no sea el que suena. **No cambies el palo por tu cuenta.**
6. Dale el enlace `http://localhost:8766/#<slug>`.

## Capa añadida a mano
Si el usuario deja un audio en `songs/<slug>/stems/` (p. ej. `guitarra.mp3`):
```bash
uv run --project analysis flamenco-study onsets songs/<slug>
```

## Palo nuevo
Crear `palos/<id>.json` copiando el formato de `palos/bulerias.json`. Los acentos, la longitud del ciclo y el rango de tempo **solo con fuentes verificadas** (WebSearch), citadas en `sources`. Si no se pueden verificar: `accents: null`, `status: "TODO"`.

## No hacer
- No commitear ni subir audios (`songs/` está en `.gitignore`).
- No editar `user/overrides.json`: son las correcciones del usuario.
