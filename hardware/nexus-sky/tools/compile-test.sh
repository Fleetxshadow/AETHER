#!/usr/bin/env bash
# Compile isolated source with fake credentials; never alter local secrets.
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
temporary="$(mktemp -d)"
trap 'rm -rf -- "$temporary"' EXIT
mkdir "$temporary/nexus_eye"
cp "$root/firmware/nexus_eye/nexus_eye.ino" "$root/firmware/nexus_eye/config.h" "$temporary/nexus_eye/"
cp "$root/firmware/nexus_eye/secrets.example.h" "$temporary/nexus_eye/secrets.h"
"${ARDUINO_CLI:-arduino-cli}" compile --fqbn esp32:esp32:esp32cam \
  --build-path "$temporary/build" "$temporary/nexus_eye"
