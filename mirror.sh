#!/usr/bin/env bash
# Mirror bravetofu/spltiers → bravetofu/spltiers_codex
set -euo pipefail

SOURCE="https://github.com/bravetofu/spltiers.git"
TARGET="https://github.com/bravetofu/spltiers_codex.git"
TMP_DIR="$(mktemp -d)"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "Cloning mirror from $SOURCE ..."
git clone --mirror "$SOURCE" "$TMP_DIR/repo.git"

echo "Pushing mirror to $TARGET ..."
cd "$TMP_DIR/repo.git"
git push --mirror "$TARGET"

echo "Done."
