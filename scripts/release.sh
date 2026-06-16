#!/usr/bin/env bash
# Full release pipeline for Island Vault:
#   1. build the macOS app + DMG/zip
#   2. reinstall the local /Applications build
#   3. publish (or update) the matching GitHub release with the installer assets
#
# Commit & push your source changes BEFORE running this. Usage: scripts/release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"
APP="Island Vault"
DMG="dist/Island-Vault-arm64.dmg"
ZIP="dist/Island-Vault-arm64.zip"
PAGES="https://pokharnajay.github.io/island-vault/"

echo "▶ Building $APP $VERSION …"
npm run build:mac

echo "▶ Installing local build to /Applications …"
pkill -f "$APP.app/Contents/MacOS/$APP" 2>/dev/null || true
sleep 1
rm -rf "/Applications/$APP.app"
ditto "dist/mac-arm64/$APP.app" "/Applications/$APP.app"
open "/Applications/$APP.app"

echo "▶ Publishing GitHub release $TAG …"
NOTES="Island Vault $VERSION — Dynamic Island clipboard vault for macOS (Apple Silicon).

Install: open the .dmg, drag Island Vault to Applications, then right-click → Open on first launch (unsigned build).

Download page: $PAGES"

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$DMG" "$ZIP" --clobber
  gh release edit "$TAG" --title "Island Vault $VERSION" --notes "$NOTES"
else
  gh release create "$TAG" "$DMG" "$ZIP" --title "Island Vault $VERSION" --notes "$NOTES"
fi

echo "✓ Released $TAG · installed locally · assets uploaded"
echo "  Download: https://github.com/pokharnajay/island-vault/releases/latest/download/Island-Vault-arm64.dmg"
