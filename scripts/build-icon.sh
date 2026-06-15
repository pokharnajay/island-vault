#!/usr/bin/env bash
# Build macOS icon assets from a single source SVG.
# Usage: scripts/build-icon.sh <source.svg>
# Produces: build/icon.icns, build/icon.png (1024), build/icon-512.png
set -euo pipefail

SRC="${1:?usage: build-icon.sh <source.svg>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
ISET="$(mktemp -d)/icon.iconset"
mkdir -p "$BUILD" "$ISET"

render() { rsvg-convert -w "$1" -h "$1" "$SRC" -o "$2"; }

# Each macOS iconset slot is rendered straight from the vector for max crispness.
render 16   "$ISET/icon_16x16.png"
render 32   "$ISET/icon_16x16@2x.png"
render 32   "$ISET/icon_32x32.png"
render 64   "$ISET/icon_32x32@2x.png"
render 128  "$ISET/icon_128x128.png"
render 256  "$ISET/icon_128x128@2x.png"
render 256  "$ISET/icon_256x256.png"
render 512  "$ISET/icon_256x256@2x.png"
render 512  "$ISET/icon_512x512.png"
render 1024 "$ISET/icon_512x512@2x.png"

iconutil -c icns "$ISET" -o "$BUILD/icon.icns"
render 1024 "$BUILD/icon.png"
render 512  "$BUILD/icon-512.png"
rm -rf "$(dirname "$ISET")"
echo "wrote $BUILD/icon.icns, $BUILD/icon.png, $BUILD/icon-512.png"
