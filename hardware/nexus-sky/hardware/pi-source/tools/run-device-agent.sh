#!/usr/bin/env bash
# Boot entrypoint: the agent manages metrics, discovery and camera worker(s).
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
if [[ ! -r config/aether.private.env ]]; then
  echo 'Missing private device token file: config/aether.private.env' >&2
  exit 1
fi
set -a
. config/aether.private.env
set +a
if [[ -z "${NEXUS_DEVICE_TOKEN:-}" || ${#NEXUS_DEVICE_TOKEN} -lt 32 ]]; then
  echo 'Device token is missing or too short' >&2
  exit 1
fi
config='config/aether-agent.example.json'
if [[ -f config/aether-agent.private.json ]]; then
  config='config/aether-agent.private.json'
fi
exec "$root/.venv/bin/python" -m aether_device.agent --config "$config"
