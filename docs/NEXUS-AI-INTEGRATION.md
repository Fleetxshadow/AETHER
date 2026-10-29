# NEXUS AI INTEGRATION ARCHITECTURE GUIDE
## Operation Aether Fusion: Connecting NEXUS AI to AETHER CITY Without UI Changes
**Date:** 2026-10-27  
**Branch:** `feature/nexus-ai-integration`  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Executive Summary

This document details the architectural integration of the trained NEXUS AI models (**VISION**, **CORE**, **MAVERICK**) from `/home/blu/Projects/nexus-sky` into the **AETHER CITY** Next.js platform at `/home/blu/Projects/AETHER`.

### The Core Mandate: Absolute UI Preservation
The entire user interface—including CSS, Tailwind classes, typography, fonts, color palettes, animations, MapLibre geospatial maps, and Three.js 3D scenes—has been **100% preserved without modification**. 

Instead of altering UI components, the integration operates exclusively through:
1. **Next.js Server-Side API Adapters:** Typed proxies (`/api/nexus/*`) validating data boundaries and handling timeouts.
2. **Local Data Provider (`src/lib/data/nexus-provider.ts`):** Implements AETHER's `DataProvider` interface, feeding into the existing `NexusDataController`.
3. **Data Provenance System:** Transparent state machine managing `LIVE`, `DEMO`, `STALE`, and `OFFLINE` data without commingling synthetic demo data with live measurements.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 AETHER CITY Web Client                      │
│   (Next.js 16, React 19, Zustand Store, MapLibre, Three.js)  │
│                                                             │
│   Existing UI Components (Preserved Without Modifications):  │
│   - CameraPanel      - CommandTelemetry    - OpsPipeline    │
│   - TrafficDashboard - ModuleVisual        - Workspaces     │
└──────────────────────────────▲──────────────────────────────┘
                               │ Reads state
┌──────────────────────────────┴──────────────────────────────┐
│                    NexusDataController                      │
│             (src/lib/data/data-provider.ts)                 │
│   - Freshness & TTL checks (60s maxAge)                     │
│   - Selective module replacement ('sky' live, others demo)  │
│   - Source classification: LIVE | DEMO | STALE | OFFLINE    │
└──────────────────────────────▲──────────────────────────────┘
                               │ Subscribes
┌──────────────────────────────┴──────────────────────────────┐
│                    NexusLocalProvider                       │
│             (src/lib/data/nexus-provider.ts)                │
│   - Polls /api/nexus/feeds atomic state endpoint            │
│   - Emits validated feeds: devices, telemetry, observations │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP / JSON
┌──────────────────────────────┴──────────────────────────────┐
│                 Next.js API Route Proxies                   │
│   - /api/nexus/health        - /api/nexus/vision/infer      │
│   - /api/nexus/core/evaluate - /api/nexus/maverick/plan     │
│   - /api/nexus/feeds         - /api/nexus/devices           │
└──────────────────────────────▲──────────────────────────────┘
                               │ Loopback (127.0.0.1:8000)
┌──────────────────────────────┴──────────────────────────────┐
│             NEXUS Local AI Server (FastAPI)                 │
│   - Ultralytics YOLOv8n (aerial_visdrone_epoch5.pt)         │
│   - CORE ONNX Decision Engine + Safety Guard Rules R1–R6    │
│   - MAVERICK ONNX Navigation Policy + A* Oracle Fallback    │
│   - Multi-channel calibrated device & telemetry feeds       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Integration & Model Mapping

### 3.1 NEXUS VISION (Aerial Detection)
- **Model Checkpoint:** `nexus-vision/weights/aerial_visdrone_epoch5.pt` (YOLOv8n trained 5 epochs on VisDrone aerial dataset).
- **Classes (10):** Pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, motor.
- **Runtime:** CPU inference via PyTorch / Ultralytics runtime.
- **AETHER Binding:** When camera frames or uploaded images are processed, detected objects map to AETHER's `aiSchema` and `liveObservationSchema`. Zero-detection scenarios return explicit explanatory reasons rather than failing.

### 3.2 NEXUS CORE (Decision Intelligence & Deterministic Guard)
- **Model Checkpoint:** `nexus-ai/runs/cpu-reproduction-20261015/core/core.onnx` (14 normalized environmental features $\to$ 6 action classes).
- **Deterministic Guard (Fail-Closed Rules R1–R6):**
  - **R1:** Battery $\le 10\%$ or motor fault $\to$ `emergency_land_sim`.
  - **R2:** Geofence breach, invalid navigation, collision risk $\ge 0.8$, or observation age $> 2\text{s}$ $\to$ `hold_position`.
  - **R3:** Battery $< 25\%$, wind $> 10\text{ m/s}$, or return mission $\to$ `return_to_base`.
  - **R4:** Severe confident incident $\to$ `alert_operator` (operator decision required).
  - **R5:** Possible incident $\to$ `inspect_sim`.
  - **R6:** Normal operations $\to$ `monitor`.
- **AETHER Binding:** Evaluated through `POST /api/nexus/core/evaluate`. Recommendations are advisory; operator review is required before taking actions.

### 3.3 NEXUS MAVERICK (Digital Twin Navigation)
- **Model Checkpoint:** `nexus-ai/runs/cpu-reproduction-20261015/maverick/maverick.onnx`.
- **Runtime:** 35-input egocentric local perception policy rollout with independent supervisor collision veto.
- **Safety Oracle:** A* optimal pathfallback activates if the policy encounters a dynamic deadlock or veto loop.
- **Strict Boundary:** MAVERICK is **simulation-only**. No physical drone motor commands are ever transmitted.

---

## 4. Hardware and Telemetry Boundaries (Codex Contract)

As defined in `docs/NEXUS-INTEGRATION-CONTRACT.md`:
1. Codex manages physical ESP32 and Raspberry Pi hardware nodes.
2. Ingested telemetry must conform strictly to AETHER's `readingSchema` units and physical bounds:
   - `temperature`: `°C` in `[-100, 2000]`
   - `speed`: `km/h` in `[0, 350]`
   - `rainfall`: `mm` in `[0, 5000]`
   - `water`: `cm` in `[0, 100000]`
   - `health`: `%` in `[0, 100]`
   - `altitude`: `m` in `[0, 50000]`
   - `battery`: `%` in `[0, 100]`
3. If hardware nodes disconnect, the device is flagged `offline` and the frontend seamlessly falls back to labeled demo telemetry without crashing.

---

## 5. CPU Inference Performance

Measured on the target system hardware (**Intel Core i5-1235U**, 8 GB RAM):

| Subsystem | Model / Task | Mean Latency | Min Latency | Max Latency | p95 Latency |
|---|---|---|---|---|---|
| **VISION** | YOLOv8n VisDrone (640x480) | **91.49 ms** | 78.40 ms | 106.60 ms | 106.06 ms |
| **CORE** | ONNX + Guard Rules R1–R6 | **0.194 ms** | 0.039 ms | 7.385 ms | 0.063 ms |
| **MAVERICK** | ONNX Policy + A* Oracle | **0.180 ms** | 0.140 ms | 0.540 ms | 0.230 ms |

**Assessment:** The system comfortably achieves $\sim 11$ FPS for aerial vision inference and sub-millisecond evaluation for mission decisions and route planning on standard laptop CPU compute. No GPU or cloud instances are required.

---

## 6. How to Launch

Use the one-command launcher:
```bash
./scripts/start-all.sh
```
This automatically initiates:
1. NEXUS AI Backend on `http://127.0.0.1:8000`
2. AETHER Next.js Web on `http://localhost:3000`
3. Graceful cleanup and teardown on `Ctrl+C`.
