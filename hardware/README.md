# Aether Link device integration

Full instructions: [NEXUS-HARDWARE-INTEGRATION.md](../docs/NEXUS-HARDWARE-INTEGRATION.md).

Pi agent authoritative source is on nexus@nexus.local under ~/nexus-sky/aether_device. pi-source is the matching review/recovery snapshot copied from the Pi. Develop future Pi changes there, then refresh the snapshot deliberately. gateway.py is laptop-side code. Config examples are illustrative; none claim connected cameras. Private token files in config are ignored and must not be committed.

Run gateway tests with `python3 -m unittest discover -s hardware/tests -v`. The optional smoke_live_pi.py requires the real Pi agent, tunnel, gateway and sourced private tokens. The TS compatibility check requires the existing AETHER checkout's tsx and validators; it only reads AETHER files.
