#!/usr/bin/env bash
# Compile only: no port selection, upload, erase, or flashing.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cli="${ARDUINO_CLI:-arduino-cli}"
if [[ ! -f "$root/firmware/nexus_eye/secrets.h" ]]; then
  echo 'Missing local secrets.h. See README.md; no hardware is required to compile.' >&2
  exit 1
fi
"$cli" compile --fqbn esp32:esp32:esp32cam --build-path "$root/build" "$root/firmware/nexus_eye"
