'use client';
import { Moon, Sun, RotateCcw, X } from 'lucide-react';
import { useNexus, type CameraPreset } from '@/lib/store';
import { layerLabels, type Layer } from '@/lib/modules';
import { playCue } from '@/lib/sound';
export function CityControls({ compact = false }: { compact?: boolean }) {
  const layer = useNexus((s) => s.layer);
  const setLayer = useNexus((s) => s.setLayer);
  const day = useNexus((s) => s.day);
  const setDay = useNexus((s) => s.setDay);
  const camera = useNexus((s) => s.camera);
  const setCamera = useNexus((s) => s.setCamera);
  const building = useNexus((s) => s.selectedBuilding);
  const setBuilding = useNexus((s) => s.selectBuilding);
  return (
    <div className={`city-controls ${compact ? 'compact' : ''}`}>
      <div className="city-layer-controls">
        {(Object.keys(layerLabels) as Layer[]).map((id) => (
          <button
            key={id}
            aria-pressed={layer === id}
            className={layer === id ? 'active' : ''}
            onClick={() => {
              setLayer(id);
              void playCue('scene');
            }}
          >
            <span className={`layer-dot ${id}`} />
            {layerLabels[id]}
          </button>
        ))}
      </div>
      <div className="city-camera-controls">
        <label className="sr-only" htmlFor={compact ? 'command-camera' : 'experience-camera'}>
          Camera preset
        </label>
        <select
          id={compact ? 'command-camera' : 'experience-camera'}
          value={camera}
          onChange={(e) => setCamera(e.target.value as CameraPreset)}
        >
          <option value="overview">Overview camera</option>
          <option value="central">Central district</option>
          <option value="riverfront">Riverfront</option>
          <option value="park">West parkland</option>
          <option value="selected">Selected observation</option>
        </select>
        <button
          className="icon-button"
          onClick={() => setDay(!day)}
          aria-label={day ? 'Switch to night lighting' : 'Switch to day lighting'}
          aria-pressed={day}
        >
          {day ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          className="icon-button"
          onClick={() => {
            setCamera('overview');
            useNexus.getState().select(null);
          }}
          aria-label="Reset city view"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      {building && (
        <div className="building-detail" role="status">
          <div>
            <span className="eyebrow">SELECTED STRUCTURE</span>
            <strong>{building}</strong>
            <p>Conceptual structure · synthetic building data</p>
          </div>
          <button
            className="icon-button"
            onClick={() => setBuilding(null)}
            aria-label="Close building details"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
