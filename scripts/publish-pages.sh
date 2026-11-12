#!/usr/bin/env bash
# Publishes web/dist-static to the gh-pages branch of "origin" as a single fresh commit,
# so the (audio-heavy) history never accumulates. Run the two build steps in README first.
set -euo pipefail

message="${1:?Uso: scripts/publish-pages.sh \"mensaje del commit\"}"
root="$(cd "$(dirname "$0")/.." && pwd)"
site="$root/web/dist-static"

[ -f "$site/index.html" ] || { echo "Falta web/dist-static: ejecuta antes build:static y export-static" >&2; exit 1; }
remote="$(git -C "$root" remote get-url origin)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cp -R "$site/." "$tmp/"
cd "$tmp"

git init -q -b gh-pages
git add -A
git -c user.name="Javier Jimenez" -c user.email="fjjimenezrios@gmail.com" commit -q -m "$message"
git push --force "$remote" gh-pages
