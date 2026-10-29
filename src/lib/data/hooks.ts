'use client';
import { useNexus } from '../store';
import { telemetry, type SensorChannel } from '../telemetry';
import { timeLabel } from '../data';
import type { ModuleId } from '../modules';
export function readingTime(value: string) {
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value)) + ' IST'
  );
}
export function useMetric(channel: SensorChannel | null, module?: ModuleId) {
  const history = useNexus((s) => s.liveTelemetry);
  const step = useNexus((s) => s.timeStep);
  const readings = channel
    ? history.filter((r) => r.channel === channel && (!module || r.module === module))
    : [];
  const latest = readings.at(-1);
  const samples = latest ? readings.filter((r) => r.deviceId === latest.deviceId).slice(-60) : [];
  return latest
    ? {
        live: true,
        value: latest.value,
        unit: latest.unit,
        deviceId: latest.deviceId,
        samples,
        values: samples.map((r) => r.value),
        labels: samples.map((r) => readingTime(r.observedAt)),
        current: samples.length - 1,
      }
    : {
        live: false,
        value: channel ? telemetry[channel][step] : 0,
        unit: '',
        deviceId: '',
        samples,
        values: channel ? telemetry[channel] : [],
        labels: [0, 1, 2, 3, 4].map(timeLabel),
        current: step,
      };
}
export const useNexusData = () => useNexus((s) => s.integration);
export const useNexusObservations = () => useNexus((s) => s.records);
export const useDeviceTelemetry = () => useNexus((s) => s.integration.fresh.telemetry);
export const useCameraStatus = () => useNexus((s) => s.integration.lastKnown.cameraStatus);
export const useIncidentFeed = () => useNexus((s) => s.integration.fresh.incidents);
