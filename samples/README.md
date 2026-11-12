# Palmas y cajón

El metrónomo usa estas grabaciones, y cuando una no está en `manifest.json` usa un sonido sintetizado.
Cada golpe tiene varias variantes que se alternan para que no suene dos veces igual.

| Sonido | Autor | Licencia |
|---|---|---|
| Palmas fuertes y sordas | Santiago Sánchez Cifuentes ([Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Flamenco_samples_by_Santiago_S%C3%A1nchez_Cifuentes)) | CC0 1.0 |
| Cajón grave, agudo y fantasma | OldBassMan ([Freesound, pack «Cajon»](https://freesound.org/people/OldBassMan/packs/9321/)) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

Los cajones están recortados y normalizados (cambios hechos a partir de las grabaciones originales). `sources.json`
lista, archivo por archivo, el autor, la licencia y la dirección de origen.

## Regenerarlos

Descarga cada fuente en su propia carpeta (las palmas de Commons y los `151030`–`151054` de Freesound, como
`<id>.mp3`) y ejecuta, sin entrar en esas carpetas:

```bash
analysis/.venv/bin/python -I scripts/build_samples.py --palmas CARPETA_PALMAS --cajon CARPETA_CAJON --out web/public/samples
```

## Usar otras grabaciones

Guarda los archivos aquí (`.wav`, `.mp3` u `.ogg`, un golpe corto cada uno) y cambia `manifest.json`. Cada golpe
admite un archivo o una lista de variantes:

```json
{ "clap": ["palma-fuerte-1.wav", "palma-fuerte-2.wav"], "bass": "cajon-grave-1.wav" }
```

Los nombres de golpe son `clap` (palma fuerte), `clapSoft` (palma sorda), `bass` (cajón grave), `slap` (cajón
agudo) y `ghost` (cajón fantasma). Usa los WAV sin compresión con pérdida: los MP3 añaden un silencio al
principio que retrasaría el golpe. Publica solo grabaciones con las que tengas derecho a hacerlo.
