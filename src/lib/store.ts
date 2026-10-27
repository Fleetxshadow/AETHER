'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layer } from './modules';
import { observations, visibleObservations, normalizeStep, type Observation } from './data';
import { initialIntegration, type IntegrationState, type LiveReading } from './data/types';

export type CameraPreset = 'overview' | 'central' | 'riverfront' | 'park' | 'selected';
export type FocusMode = 'city' | 'twin' | 'analytics' | 'mission';
export type Quality = 'high' | 'balanced' | 'low' | 'off';
interface NexusState {
  integration: IntegrationState;
  liveTelemetry: LiveReading[];
  demoStatus: 'loading' | 'ready' | 'error';
  dataRetry: number;
  retryData: () => void;
  applyData: (
    records: Observation[],
    integration: IntegrationState,
    liveTelemetry: LiveReading[],
  ) => void;
  records: Observation[];
  setRecords: (records: Observation[]) => void;
  selectedId: string | null;
  spatialSelection: string | null;
  selectSpatial: (id: string | null) => void;
  selectedBuilding: string | null;
  timeStep: number;
  layer: Layer;
  camera: CameraPreset;
  mode: FocusMode;
  day: boolean;
  sound: boolean;
  volume: number;
  quality: Quality;
  motion: boolean;
  select: (id: string | null) => void;
  selectBuilding: (name: string | null) => void;
  setTime: (step: number) => void;
  setLayer: (layer: Layer) => void;
  setCamera: (camera: CameraPreset) => void;
  setMode: (mode: FocusMode) => void;
  setDay: (day: boolean) => void;
  setSound: (sound: boolean) => void;
  setVolume: (volume: number) => void;
  setQuality: (quality: Quality) => void;
  setMotion: (motion: boolean) => void;
}
export const useNexus = create<NexusState>()(
  persist(
    (set) => ({
      integration: initialIntegration(),
      liveTelemetry: [],
      demoStatus: 'loading',
      dataRetry: 0,
      retryData: () => set((s) => ({ dataRetry: s.dataRetry + 1 })),
      applyData: (records, integration, liveTelemetry) =>
        set((s) => ({
          records,
          integration,
          liveTelemetry,
          selectedId: records.some((o) => o.id === s.selectedId) ? s.selectedId : null,
        })),
      records: observations,
      setRecords: (records) =>
        set((state) => ({
          records,
          selectedId: visibleObservations(records, state.timeStep).some(
            (o) => o.id === state.selectedId,
          )
            ? state.selectedId
            : null,
        })),
      selectedId: null,
      spatialSelection: null,
      selectSpatial: (spatialSelection) => set({ spatialSelection, selectedId: null }),
      selectedBuilding: null,
      timeStep: 3,
      layer: 'network',
      camera: 'overview',
      mode: 'city',
      day: false,
      sound: false,
      volume: 0.25,
      quality: 'balanced',
      motion: true,
      select: (id) =>
        set((state) => {
          const selectedId = visibleObservations(state.records, state.timeStep).some(
            (o) => o.id === id,
          )
            ? id
            : null;
          return {
            selectedId,
            spatialSelection: null,
            selectedBuilding: null,
            camera: selectedId ? 'selected' : 'overview',
          };
        }),
      selectBuilding: (selectedBuilding) => set({ selectedBuilding }),
      setTime: (step) =>
        set((state) => {
          const timeStep = normalizeStep(step);
          const selectedId = visibleObservations(state.records, timeStep).some(
            (o) => o.id === state.selectedId,
          )
            ? state.selectedId
            : null;
          return { timeStep, selectedId, camera: selectedId ? state.camera : 'overview' };
        }),
      setLayer: (layer) => set({ layer }),
      setCamera: (camera) => set({ camera }),
      setMode: (mode) => set({ mode }),
      setDay: (day) => set({ day }),
      setSound: (sound) => set({ sound }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setQuality: (quality) => set({ quality }),
      setMotion: (motion) => set({ motion }),
    }),
    {
      name: 'nexus-preferences-v2',
      partialize: (state) => ({
        sound: state.sound,
        volume: state.volume,
        quality: state.quality,
        motion: state.motion,
      }),
      skipHydration: true,
    },
  ),
);
