'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Cpu,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Shield,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Crosshair,
} from 'lucide-react';

// ==============================================================================
// TYPES
// ==============================================================================

interface VisionSample {
  filename: string;
  size_kb: number;
  path: string;
}

interface VisionDetection {
  box: [number, number, number, number];
  confidence: number;
  class_id: number;
  class_name: string;
}

interface VisionInferResult {
  success: boolean;
  source: string;
  timestamp: string;
  model_used: string;
  conf_threshold: number;
  latency_ms: number;
  image_dims: { width: number; height: number };
  total_objects: number;
  class_counts: Record<string, number>;
  detections: VisionDetection[];
  annotated_base64: string | null;
  zero_detections_reason?: string | null;
}

interface CorePreset {
  id: string;
  name: string;
  description: string;
  observation: {
    scenario_id?: string;
    mission_id?: string;
    mission_type?: string;
    battery: number;
    wind_mps: number;
    collision_risk: number;
    observation_age_s?: number;
    incident_confidence: number;
    incident_severity: number;
    visibility?: number;
    people_density?: number;
    navigation_valid: boolean;
    motor_fault: boolean;
    geofence_breach: boolean;
    source?: string;
  };
}

interface CoreEvaluateResult {
  success: boolean;
  source: string;
  timestamp: string;
  raw_class: string;
  recommendation: string;
  safety_reason: string;
  guard_intervened: boolean;
  operator_decision_required: boolean;
  duration_ms: number;
}

interface MaverickPreset {
  id: string;
  name: string;
  grid_size: number;
  start: [number, number];
  goal: [number, number];
  description: string;
  terrain?: number[][];
}

interface MaverickIntervention {
  step: number;
  proposed_action: string;
  reason: string;
  vetoed_action?: string;
}

interface MaverickPlanResult {
  success: boolean;
  source: string;
  timestamp: string;
  status: string;
  steps: number;
  path: [number, number][];
  astar_path: [number, number][];
  supervisor_interventions: number;
  interventions_detail: (string | MaverickIntervention)[];
  used_fallback?: boolean;
  duration_ms: number;
  efficiency?: string;
}

type LabTab = 'vision' | 'core' | 'maverick';

// ==============================================================================
// 1. VISION LAB COMPONENT
// ==============================================================================

function VisionLab() {
  const [samples, setSamples] = useState<VisionSample[]>([]);
  const [selectedSample, setSelectedSample] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('aerial_visdrone_epoch5.pt');
  const [confThreshold, setConfThreshold] = useState<number>(0.25);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VisionInferResult | null>(null);

  useEffect(() => {
    async function loadSamples() {
      try {
        const res = await fetch('/api/nexus/lab/vision/samples');
        if (res.ok) {
          const data = await res.json();
          const list = data.samples || [];
          setSamples(list);
          if (list.length > 0 && !selectedSample) {
            setSelectedSample(list[0].filename);
            setPreviewSrc(`/api/nexus/lab/vision/sample-image?filename=${list[0].filename}`);
          }
        }
      } catch (err) {
        console.error('Failed to load vision samples:', err);
      }
    }
    void loadSamples();
  }, []);

  const handleSampleChange = (filename: string) => {
    setSelectedSample(filename);
    setUploadFile(null);
    setResult(null);
    setError(null);
    if (filename) {
      setPreviewSrc(`/api/nexus/lab/vision/sample-image?filename=${filename}`);
    } else {
      setPreviewSrc(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setSelectedSample('');
      setResult(null);
      setError(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPreviewSrc(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRunDetection = async () => {
    if (!uploadFile && !selectedSample) {
      setError('Please select a sample image or upload a custom file.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let res: Response;
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('model_name', selectedModel);
        formData.append('conf_threshold', confThreshold.toString());
        formData.append('annotate', 'true');
        res = await fetch('/api/nexus/vision/infer', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/nexus/vision/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sample_id: selectedSample,
            model_name: selectedModel,
            conf_threshold: confThreshold,
            annotate: true,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || `Inference error: HTTP ${res.status}`);
      }

      const data: VisionInferResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vision inference failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lab-layout-split">
      {/* Sidebar Controls */}
      <div className="lab-sidebar">
        <h3 className="lab-sidebar-heading">1. Select Input Image</h3>
        <div className="lab-form-group">
          <label className="lab-form-label" htmlFor="vision-sample-select">
            Sample Image (Held-out Val Set)
          </label>
          <select
            id="vision-sample-select"
            className="lab-select"
            value={selectedSample}
            onChange={(e) => handleSampleChange(e.target.value)}
          >
            <option value="">-- Custom uploaded image --</option>
            {samples.map((s) => (
              <option key={s.filename} value={s.filename}>
                {s.filename} ({s.size_kb} KB)
              </option>
            ))}
          </select>
          <span className="lab-form-hint">Real aerial images from VisDrone validation split.</span>
        </div>

        <div className="lab-form-group">
          <label className="lab-form-label" htmlFor="vision-upload-input">
            Or Upload Custom Aerial / Street Image
          </label>
          <input
            type="file"
            id="vision-upload-input"
            accept="image/*"
            className="lab-file-input"
            onChange={handleFileUpload}
          />
        </div>

        <h3 className="lab-sidebar-heading">2. Detector Weights & Parameters</h3>
        <div className="lab-form-group">
          <label className="lab-form-label" htmlFor="vision-model-select">
            Trained Model Checkpoint
          </label>
          <select
            id="vision-model-select"
            className="lab-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="aerial_visdrone_epoch5.pt">Aerial VisDrone Ep5 (Primary)</option>
            <option value="damage_epoch1.pt">Road Damage RDD2022 Ep1</option>
            <option value="vehicles_india_uvh_epoch1.pt">Vehicles India UVH Ep1</option>
            <option value="traffic_coco_epoch1.pt">Traffic COCO Ep1</option>
          </select>
        </div>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="vision-conf-slider">
              Confidence Threshold
            </label>
            <span className="lab-range-val">{confThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            id="vision-conf-slider"
            min="0.05"
            max="0.95"
            step="0.05"
            value={confThreshold}
            onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
            className="lab-range"
          />
          <span className="lab-form-hint">
            Lower to 0.10–0.15 for distant or small aerial objects.
          </span>
        </div>

        <button
          className="lab-btn-primary"
          onClick={handleRunDetection}
          disabled={loading || (!uploadFile && !selectedSample)}
        >
          {loading ? (
            <>
              <Clock size={16} className="animate-spin" /> Running Detection...
            </>
          ) : (
            <>
              <Play size={16} /> Run Detection
            </>
          )}
        </button>

        {error && (
          <div className="lab-callout-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="lab-main-view">
        <div className="lab-stats-bar">
          <span className="lab-stat-pill">
            Objects: <strong>{result ? result.total_objects : 0}</strong>
          </span>
          <span className="lab-stat-pill">
            Latency: <strong>{result ? `${result.latency_ms.toFixed(1)} ms` : '--'}</strong>
          </span>
          <span className="lab-stat-pill">
            Model: <strong>{selectedModel}</strong>
          </span>
          <span className="lab-stat-pill">
            Threshold: <strong>{confThreshold.toFixed(2)}</strong>
          </span>
        </div>

        <div className="lab-viewport">
          {result?.annotated_base64 ? (
            <img src={result.annotated_base64} alt="Annotated Vision Detection" />
          ) : previewSrc ? (
            <img src={previewSrc} alt="Input Image Preview" />
          ) : (
            <div className="lab-empty-viewport">
              <Camera size={36} />
              <p>Select a sample image or upload a file, then click Run Detection.</p>
            </div>
          )}
        </div>

        {/* Zero Detections Diagnostic Box */}
        {result && result.total_objects === 0 && (
          <div className="lab-callout-info">
            <Info size={18} />
            <div>
              <strong>Zero Detections Reported:</strong>{' '}
              {result.zero_detections_reason ||
                `No objects exceeded the ${confThreshold.toFixed(2)} confidence threshold. Consider lowering the slider to 0.10 or testing a different checkpoint.`}
            </div>
          </div>
        )}

        {/* Classes Breakdown */}
        {result && Object.keys(result.class_counts).length > 0 && (
          <div className="lab-form-group">
            <label className="lab-form-label">Detected Object Classes</label>
            <div className="lab-tags-container">
              {Object.entries(result.class_counts).map(([cls, count]) => (
                <span key={cls} className="lab-class-tag">
                  <strong>{cls}</strong> × {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bounding Boxes Table */}
        {result && result.detections.length > 0 && (
          <div className="lab-table-container">
            <table className="lab-data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Confidence</th>
                  <th>Bounding Box [ymin, xmin, ymax, xmax]</th>
                </tr>
              </thead>
              <tbody>
                {result.detections.map((det, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{det.class_name}</strong>
                    </td>
                    <td>{(det.confidence * 100).toFixed(1)}%</td>
                    <td className="mono">
                      [{det.box.map((v) => Math.round(v * 10) / 10).join(', ')}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// 2. CORE DECISION LAB COMPONENT
// ==============================================================================

function CoreLab() {
  const [presets, setPresets] = useState<CorePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('routine_patrol');
  const [battery, setBattery] = useState<number>(88);
  const [windMps, setWindMps] = useState<number>(3.2);
  const [collisionRisk, setCollisionRisk] = useState<number>(8);
  const [severity, setSeverity] = useState<number>(10);
  const [confidence, setConfidence] = useState<number>(15);
  const [motorFault, setMotorFault] = useState<boolean>(false);
  const [geofenceBreach, setGeofenceBreach] = useState<boolean>(false);
  const [navValid, setNavValid] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoreEvaluateResult | null>(null);

  useEffect(() => {
    async function loadPresets() {
      try {
        const res = await fetch('/api/nexus/lab/core/presets');
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets || []);
        }
      } catch (err) {
        console.error('Failed to load core presets:', err);
      }
    }
    void loadPresets();
  }, []);

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const obs = p.observation;
    setBattery(Math.round(obs.battery * 100));
    setWindMps(obs.wind_mps);
    setCollisionRisk(Math.round(obs.collision_risk * 100));
    setSeverity(Math.round(obs.incident_severity * 100));
    setConfidence(Math.round(obs.incident_confidence * 100));
    setMotorFault(Boolean(obs.motor_fault));
    setGeofenceBreach(Boolean(obs.geofence_breach));
    setNavValid(obs.navigation_valid !== false);
    setResult(null);
    setError(null);
  };

  const handleEvaluate = async () => {
    setLoading(true);
    setError(null);

    const observation = {
      scenario_id: `scen-lab-${Date.now()}`,
      mission_id: `miss-lab-${Date.now()}`,
      mission_type: 'survey',
      battery: battery / 100,
      wind_mps: windMps,
      collision_risk: collisionRisk / 100,
      incident_severity: severity / 100,
      incident_confidence: confidence / 100,
      observation_age_s: 0.5,
      visibility: 0.9,
      people_density: 0.1,
      navigation_valid: navValid,
      motor_fault: motorFault,
      geofence_breach: geofenceBreach,
      source: 'simulation',
    };

    try {
      const res = await fetch('/api/nexus/core/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || `HTTP ${res.status}`);
      }

      const data: CoreEvaluateResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CORE evaluation failed.');
    } finally {
      setLoading(false);
    }
  };

  const activeRule = result?.safety_reason
    ? result.safety_reason.match(/R[1-6]/)?.[0] || null
    : null;

  return (
    <div className="lab-layout-split">
      {/* Sidebar Controls */}
      <div className="lab-sidebar">
        <h3 className="lab-sidebar-heading">1. Select Preset Scenario</h3>
        <div className="lab-form-group">
          <label className="lab-form-label" htmlFor="core-preset-select">
            Scenario Presets
          </label>
          <select
            id="core-preset-select"
            className="lab-select"
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="">-- Custom observation inputs --</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="lab-form-hint">
            Pre-configured observations illustrating each safety rule.
          </span>
        </div>

        <h3 className="lab-sidebar-heading">2. Interactive Telemetry Controls</h3>
        <span className="lab-synthetic-tag">⚠️ SYNTHETIC TEST OBSERVATIONS</span>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="core-battery">
              Battery Level
            </label>
            <span className="lab-range-val">{battery}%</span>
          </div>
          <input
            type="range"
            id="core-battery"
            min="0"
            max="100"
            value={battery}
            onChange={(e) => {
              setBattery(parseInt(e.target.value, 10));
              setSelectedPresetId('');
            }}
            className="lab-range"
          />
          <span className="lab-form-hint">Rule R1 forces emergency land if battery ≤ 10%.</span>
        </div>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="core-wind">
              Wind Speed
            </label>
            <span className="lab-range-val">{windMps.toFixed(1)} m/s</span>
          </div>
          <input
            type="range"
            id="core-wind"
            min="0"
            max="20"
            step="0.5"
            value={windMps}
            onChange={(e) => {
              setWindMps(parseFloat(e.target.value));
              setSelectedPresetId('');
            }}
            className="lab-range"
          />
          <span className="lab-form-hint">Rule R3 forces return to base if wind &gt; 10 m/s.</span>
        </div>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="core-risk">
              Collision Risk
            </label>
            <span className="lab-range-val">{collisionRisk}%</span>
          </div>
          <input
            type="range"
            id="core-risk"
            min="0"
            max="100"
            value={collisionRisk}
            onChange={(e) => {
              setCollisionRisk(parseInt(e.target.value, 10));
              setSelectedPresetId('');
            }}
            className="lab-range"
          />
          <span className="lab-form-hint">Rule R2 forces hold position if risk ≥ 80%.</span>
        </div>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="core-severity">
              Incident Severity
            </label>
            <span className="lab-range-val">{severity}%</span>
          </div>
          <input
            type="range"
            id="core-severity"
            min="0"
            max="100"
            value={severity}
            onChange={(e) => {
              setSeverity(parseInt(e.target.value, 10));
              setSelectedPresetId('');
            }}
            className="lab-range"
          />
        </div>

        <div className="lab-form-group">
          <div className="lab-range-header">
            <label className="lab-form-label" htmlFor="core-conf">
              Incident Confidence
            </label>
            <span className="lab-range-val">{confidence}%</span>
          </div>
          <input
            type="range"
            id="core-conf"
            min="0"
            max="100"
            value={confidence}
            onChange={(e) => {
              setConfidence(parseInt(e.target.value, 10));
              setSelectedPresetId('');
            }}
            className="lab-range"
          />
        </div>

        <div className="lab-toggles-grid">
          <label className="lab-toggle-label">
            <input
              type="checkbox"
              checked={motorFault}
              onChange={(e) => {
                setMotorFault(e.target.checked);
                setSelectedPresetId('');
              }}
            />
            <span>Motor Fault</span>
          </label>
          <label className="lab-toggle-label">
            <input
              type="checkbox"
              checked={geofenceBreach}
              onChange={(e) => {
                setGeofenceBreach(e.target.checked);
                setSelectedPresetId('');
              }}
            />
            <span>Geofence Breach</span>
          </label>
          <label className="lab-toggle-label">
            <input
              type="checkbox"
              checked={navValid}
              onChange={(e) => {
                setNavValid(e.target.checked);
                setSelectedPresetId('');
              }}
            />
            <span>Navigation Valid</span>
          </label>
        </div>

        <button className="lab-btn-primary" onClick={handleEvaluate} disabled={loading}>
          {loading ? (
            <>
              <Clock size={16} className="animate-spin" /> Evaluating...
            </>
          ) : (
            <>
              <Shield size={16} /> Evaluate with CORE
            </>
          )}
        </button>

        {error && (
          <div className="lab-callout-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="lab-main-view">
        <h3 className="lab-sidebar-heading">Decision & Safety Guard Evaluation</h3>

        <div className="lab-decision-grid">
          {/* Card 1: Neural Softmax */}
          <div className="lab-decision-card">
            <div className="lab-decision-header">
              <span className="lab-badge lab-badge-cyan">NEURAL POLICY</span>
              <span className="lab-form-hint">Softmax Output</span>
            </div>
            <div className="lab-decision-action">{result?.raw_class || '--'}</div>
            <p className="lab-decision-sub">
              Learned neural network policy recommendation before guard verification.
            </p>
          </div>

          {/* Card 2: Deterministic Safety Guard */}
          <div className="lab-decision-card">
            <div className="lab-decision-header">
              <span
                className={`lab-badge ${result?.guard_intervened ? 'lab-badge-amber' : 'lab-badge-emerald'}`}
              >
                {result?.guard_intervened ? 'GUARD VETO OVERRIDE' : 'GUARD VERIFIED'}
              </span>
              <span className="lab-form-hint">Fail-Closed Authority</span>
            </div>
            <div
              className="lab-decision-action"
              style={{
                color: result?.guard_intervened ? 'var(--ae-signal)' : 'var(--ae-confirm)',
              }}
            >
              {result?.recommendation || '--'}
            </div>
            <p className="lab-decision-sub">
              {result?.safety_reason || 'Click "Evaluate with CORE" to inspect safety rule.'}
            </p>
          </div>
        </div>

        {/* Rule Explanation Callout */}
        {result && (
          <div className="lab-callout-info">
            <Info size={18} />
            <div>
              <strong>Rule Verification Result:</strong> {result.safety_reason}
              {result.operator_decision_required && (
                <div style={{ marginTop: '4px', color: 'var(--ae-signal)' }}>
                  ⚠️ Operator Decision Required: Action must be confirmed before dispatch.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Priority Rule Reference Matrix Table */}
        <div className="lab-form-group">
          <label className="lab-form-label">
            Deterministic Priority Rule Reference (Fail-Closed Hierarchy)
          </label>
          <div className="lab-table-container">
            <table className="lab-data-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Condition Trigger</th>
                  <th>Enforced Action</th>
                  <th>Authority Mode</th>
                </tr>
              </thead>
              <tbody>
                <tr className={activeRule === 'R1' ? 'highlighted' : ''}>
                  <td>
                    <strong>R1</strong>
                  </td>
                  <td>Motor Fault OR Battery ≤ 10%</td>
                  <td className="mono">emergency_land_sim</td>
                  <td>Automatic Override</td>
                </tr>
                <tr className={activeRule === 'R2' ? 'highlighted' : ''}>
                  <td>
                    <strong>R2</strong>
                  </td>
                  <td>Geofence Breach OR Nav Invalid OR Risk ≥ 80%</td>
                  <td className="mono">hold_position</td>
                  <td>Automatic Override</td>
                </tr>
                <tr className={activeRule === 'R3' ? 'highlighted' : ''}>
                  <td>
                    <strong>R3</strong>
                  </td>
                  <td>Battery &lt; 25% OR Wind &gt; 10 m/s OR Return Mission</td>
                  <td className="mono">return_to_base</td>
                  <td>Automatic Override</td>
                </tr>
                <tr className={activeRule === 'R4' ? 'highlighted' : ''}>
                  <td>
                    <strong>R4</strong>
                  </td>
                  <td>Confidence ≥ 70% AND Severity ≥ 60%</td>
                  <td className="mono">alert_operator</td>
                  <td>Operator Decision</td>
                </tr>
                <tr className={activeRule === 'R5' ? 'highlighted' : ''}>
                  <td>
                    <strong>R5</strong>
                  </td>
                  <td>Confidence ≥ 40%</td>
                  <td className="mono">inspect_sim</td>
                  <td>Advisory</td>
                </tr>
                <tr className={activeRule === 'R6' ? 'highlighted' : ''}>
                  <td>
                    <strong>R6</strong>
                  </td>
                  <td>Nominal conditions</td>
                  <td className="mono">monitor</td>
                  <td>Routine</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// 3. MAVERICK NAVIGATION LAB COMPONENT
// ==============================================================================

type GridTool = 'building' | 'hazard' | 'road' | 'start' | 'goal';

function MaverickLab() {
  const [presets, setPresets] = useState<MaverickPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('downtown_corridors');
  const [gridSize, setGridSize] = useState<number>(12);
  const [terrain, setTerrain] = useState<number[][]>(() => {
    const grid: number[][] = [];
    for (let y = 0; y < 12; y++) {
      const row: number[] = [];
      for (let x = 0; x < 12; x++) {
        if ((y % 3 === 0 && x % 3 === 0) || (y === 4 && x > 2 && x < 9)) {
          row.push(1);
        } else {
          row.push(0);
        }
      }
      grid.push(row);
    }
    grid[1][1] = 0;
    grid[10][10] = 0;
    return grid;
  });
  const [start, setStart] = useState<[number, number]>([1, 1]);
  const [goal, setGoal] = useState<[number, number]>([10, 10]);
  const [activeTool, setActiveTool] = useState<GridTool>('building');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MaverickPlanResult | null>(null);

  useEffect(() => {
    async function loadPresets() {
      try {
        const res = await fetch('/api/nexus/lab/maverick/presets');
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets || []);
        }
      } catch (err) {
        console.error('Failed to load maverick presets:', err);
      }
    }
    void loadPresets();
  }, []);

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setResult(null);
    setError(null);
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;

    const n = p.grid_size || 12;
    setGridSize(n);
    setStart(p.start);
    setGoal(p.goal);

    if (p.terrain) {
      setTerrain(p.terrain.map((r) => [...r]));
    } else {
      // Build default terrain based on preset
      const grid: number[][] = [];
      for (let y = 0; y < n; y++) {
        const row: number[] = [];
        for (let x = 0; x < n; x++) {
          if (presetId === 'hazard_blockade') {
            if (y === 5 && x > 2 && x < 9) row.push(2);
            else if (y % 4 === 0 && x % 4 === 0) row.push(1);
            else row.push(0);
          } else {
            if ((y % 3 === 0 && x % 3 === 0) || (y === 4 && x > 2 && x < 9)) row.push(1);
            else row.push(0);
          }
        }
        grid.push(row);
      }
      grid[p.start[0]][p.start[1]] = 0;
      grid[p.goal[0]][p.goal[1]] = 0;
      setTerrain(grid);
    }
  };

  const resetRandomGrid = () => {
    setSelectedPresetId('');
    setResult(null);
    setError(null);
    const n = gridSize;
    const grid: number[][] = [];
    for (let y = 0; y < n; y++) {
      const row: number[] = [];
      for (let x = 0; x < n; x++) {
        const r = Math.random();
        if (r < 0.2) row.push(1); // Building
        else if (r < 0.28) row.push(2); // Hazard
        else row.push(0);
      }
      grid.push(row);
    }
    grid[start[0]][start[1]] = 0;
    grid[goal[0]][goal[1]] = 0;
    setTerrain(grid);
  };

  const clearGrid = () => {
    setSelectedPresetId('');
    setResult(null);
    setError(null);
    const n = gridSize;
    const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    setTerrain(grid);
  };

  const handleCellClick = (y: number, x: number) => {
    setSelectedPresetId('');
    setResult(null);
    setTerrain((prev) => {
      const copy = prev.map((r) => [...r]);
      if (activeTool === 'building') {
        copy[y][x] = copy[y][x] === 1 ? 0 : 1;
      } else if (activeTool === 'hazard') {
        copy[y][x] = copy[y][x] === 2 ? 0 : 2;
      } else if (activeTool === 'road') {
        copy[y][x] = 0;
      } else if (activeTool === 'start') {
        setStart([y, x]);
        copy[y][x] = 0;
      } else if (activeTool === 'goal') {
        setGoal([y, x]);
        copy[y][x] = 0;
      }
      return copy;
    });
  };

  const handlePlanRoute = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/nexus/maverick/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terrain, start, goal }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || `Route planning failed: HTTP ${res.status}`);
      }

      const data: MaverickPlanResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route planning failed.');
    } finally {
      setLoading(false);
    }
  };

  const cellSize = 600 / gridSize;
  const colors = ['#161c24', '#475569', '#991b1b']; // 0: road, 1: building, 2: hazard

  return (
    <div className="lab-layout-split">
      {/* Sidebar Controls */}
      <div className="lab-sidebar">
        <h3 className="lab-sidebar-heading">1. City Grid Map Editor</h3>
        <div className="lab-form-group">
          <label className="lab-form-label" htmlFor="maverick-preset-select">
            Map Presets
          </label>
          <select
            id="maverick-preset-select"
            className="lab-select"
            value={selectedPresetId}
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="">-- Custom grid editing --</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lab-form-group">
          <label className="lab-form-label">Active Click Tool</label>
          <div className="lab-tools-grid">
            <button
              className={`lab-tool-btn ${activeTool === 'building' ? 'active' : ''}`}
              onClick={() => setActiveTool('building')}
            >
              🏢 Building
            </button>
            <button
              className={`lab-tool-btn ${activeTool === 'hazard' ? 'active' : ''}`}
              onClick={() => setActiveTool('hazard')}
            >
              ⚠️ Hazard
            </button>
            <button
              className={`lab-tool-btn ${activeTool === 'road' ? 'active' : ''}`}
              onClick={() => setActiveTool('road')}
            >
              🛣️ Road
            </button>
            <button
              className={`lab-tool-btn ${activeTool === 'start' ? 'active' : ''}`}
              onClick={() => setActiveTool('start')}
            >
              🟢 Set Start
            </button>
            <button
              className={`lab-tool-btn ${activeTool === 'goal' ? 'active' : ''}`}
              onClick={() => setActiveTool('goal')}
            >
              🎯 Set Goal
            </button>
          </div>
          <span className="lab-form-hint">
            Click any cell on the grid to apply the selected tool.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="lab-btn-outline" onClick={resetRandomGrid}>
            <RotateCcw size={14} /> Random Map
          </button>
          <button className="lab-btn-outline" onClick={clearGrid}>
            Clear All
          </button>
        </div>

        <button className="lab-btn-primary" onClick={handlePlanRoute} disabled={loading}>
          {loading ? (
            <>
              <Clock size={16} className="animate-spin" /> Planning Route...
            </>
          ) : (
            <>
              <Compass size={16} /> Plan Route
            </>
          )}
        </button>

        {error && (
          <div className="lab-callout-error">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Viewport */}
      <div className="lab-main-view">
        <div className="lab-stats-bar">
          <span className="lab-stat-pill">
            Status:{' '}
            <strong
              style={{
                color:
                  result?.status === 'reached_goal'
                    ? 'var(--ae-confirm)'
                    : result
                      ? 'var(--ae-critical)'
                      : 'inherit',
              }}
            >
              {result ? result.status.toUpperCase() : 'READY'}
            </strong>
          </span>
          <span className="lab-stat-pill">
            Steps: <strong>{result ? result.steps : 0}</strong>
          </span>
          <span className="lab-stat-pill">
            Interventions: <strong>{result ? result.supervisor_interventions : 0}</strong>
          </span>
          <span className="lab-stat-pill">
            Latency: <strong>{result ? `${result.duration_ms.toFixed(1)} ms` : '--'}</strong>
          </span>
        </div>

        {/* Interactive SVG Grid Canvas */}
        <div className="lab-grid-wrapper">
          <svg viewBox="0 0 600 600" className="lab-grid-svg">
            {/* Terrain Cells */}
            {terrain.map((row, y) =>
              row.map((val, x) => (
                <rect
                  key={`${y}-${x}`}
                  x={x * cellSize}
                  y={y * cellSize}
                  width={cellSize - 1}
                  height={cellSize - 1}
                  rx="3"
                  fill={colors[val] || colors[0]}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                  onClick={() => handleCellClick(y, x)}
                  style={{ cursor: 'pointer' }}
                />
              )),
            )}

            {/* A* Oracle Path (Gold Dashed) */}
            {result?.astar_path && result.astar_path.length > 0 && (
              <polyline
                points={result.astar_path
                  .map(([r, c]) => `${(c + 0.5) * cellSize},${(r + 0.5) * cellSize}`)
                  .join(' ')}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="3"
                strokeDasharray="6,4"
                opacity="0.85"
              />
            )}

            {/* MAVERICK Policy Path (Cyan Solid) */}
            {result?.path && result.path.length > 0 && (
              <polyline
                points={result.path
                  .map(([r, c]) => `${(c + 0.5) * cellSize},${(r + 0.5) * cellSize}`)
                  .join(' ')}
                fill="none"
                stroke="#00f0ff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}

            {/* Start Pin Marker */}
            <circle
              cx={(start[1] + 0.5) * cellSize}
              cy={(start[0] + 0.5) * cellSize}
              r={cellSize / 3.2}
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Goal Pin Marker */}
            <circle
              cx={(goal[1] + 0.5) * cellSize}
              cy={(goal[0] + 0.5) * cellSize}
              r={cellSize / 3.2}
              fill="#f59e0b"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Map Legend */}
        <div className="lab-grid-legend">
          <span className="lab-legend-item">
            <span className="lab-legend-box" style={{ background: '#161c24' }} /> Road (Free)
          </span>
          <span className="lab-legend-item">
            <span className="lab-legend-box" style={{ background: '#475569' }} /> Building (Blocked)
          </span>
          <span className="lab-legend-item">
            <span className="lab-legend-box" style={{ background: '#991b1b' }} /> Hazard (Danger)
          </span>
          <span className="lab-legend-item">
            <span className="lab-legend-box" style={{ background: '#10b981', borderRadius: '50%' }} />{' '}
            Start Pin
          </span>
          <span className="lab-legend-item">
            <span className="lab-legend-box" style={{ background: '#f59e0b', borderRadius: '50%' }} />{' '}
            Goal Pin
          </span>
          <span className="lab-legend-item">
            <span className="lab-legend-line" style={{ background: '#00f0ff' }} /> MAVERICK Policy
          </span>
          <span className="lab-legend-item">
            <span
              className="lab-legend-line"
              style={{
                background:
                  'repeating-linear-gradient(90deg, #fbbf24 0, #fbbf24 4px, transparent 4px, transparent 8px)',
              }}
            />{' '}
            A* Oracle Path
          </span>
        </div>

        {/* Supervisor Interventions Details */}
        {result && result.interventions_detail && result.interventions_detail.length > 0 && (
          <div className="lab-form-group">
            <label className="lab-form-label">
              Algorithmic Supervisor Interventions Detail ({result.interventions_detail.length})
            </label>
            <div className="lab-table-container">
              <table className="lab-data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Detail / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.interventions_detail.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        {typeof item === 'string'
                          ? item
                          : `Step ${item.step}: Proposed ${item.proposed_action || item.vetoed_action} vetoed. Reason: ${item.reason}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==============================================================================
// MAIN AI LAB WORKSPACE COMPONENT
// ==============================================================================

export function AiLabWorkspace() {
  const [activeTab, setActiveTab] = useState<LabTab>('vision');

  return (
    <div className="lab-workspace">
      {/* Subtab Selector */}
      <div className="lab-subtabs" role="tablist" aria-label="AI Lab Modules">
        <button
          className={`lab-tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'vision'}
          onClick={() => setActiveTab('vision')}
        >
          <Camera size={16} /> VISION Lab
        </button>
        <button
          className={`lab-tab-btn ${activeTab === 'core' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'core'}
          onClick={() => setActiveTab('core')}
        >
          <Cpu size={16} /> CORE Decision Lab
        </button>
        <button
          className={`lab-tab-btn ${activeTab === 'maverick' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'maverick'}
          onClick={() => setActiveTab('maverick')}
        >
          <Compass size={16} /> MAVERICK Navigation Lab
        </button>
      </div>

      {/* Render Active Lab Tab */}
      {activeTab === 'vision' && <VisionLab />}
      {activeTab === 'core' && <CoreLab />}
      {activeTab === 'maverick' && <MaverickLab />}
    </div>
  );
}
