#!/usr/bin/env bash
# Install build tools only. Never wire, select a port, or flash hardware.
set -euo pipefail
cli="${ARDUINO_CLI:-arduino-cli}"
export ARDUINO_NETWORK_CONNECTION_TIMEOUT="${ARDUINO_NETWORK_CONNECTION_TIMEOUT:-600s}"
url='https://espressif.github.io/arduino-esp32/package_esp32_index.json'
"$cli" core update-index --additional-urls "$url"
"$cli" core install esp32:esp32@3.3.12 --additional-urls "$url"
"$cli" core list
