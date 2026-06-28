#!/bin/bash
# scripts/package-extension.sh
# Produces a clean installable zip for "Load unpacked" in Chrome.
# Excludes docs, fixtures, scripts, and dev files.
# Run: bash scripts/package-extension.sh

set -e
cd "$(dirname "$0")/.."

OUT="basketindex-extension.zip"
echo "Packaging extension..."

zip -r "$OUT" \
  manifest.json \
  service-worker.js \
  LICENSE \
  core/ \
  lib/ \
  adapters/ \
  content/ \
  popup/ \
  pages/ \
  icons/ \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*.playwright*" \
  -x "scripts/*" \
  -x "docs/*" \
  -x "fixtures/*" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "CONTRIBUTING.md" \
  -x "SECURITY.md" \
  -x "README.md" \
  -x "*.log" \
  -x "*.tmp"

echo ""
echo "Created: $OUT ($(ls -lh "$OUT" | awk '{print $5}'))"
echo ""
echo "To install:"
echo "  1. Go to chrome://extensions"
echo "  2. Enable Developer Mode"
echo "  3. Drag $OUT onto the page"
echo "     or unzip it and click 'Load unpacked' → select the folder"
echo ""
