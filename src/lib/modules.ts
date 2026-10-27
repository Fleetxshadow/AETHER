import {
  Activity,
  BrainCircuit,
  Box,
  Droplets,
  Flame,
  Gauge,
  Layers3,
  LifeBuoy,
  Radar,
  Route,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';

export const moduleIds = [
  'sky',
  'flow',
  'rescue',
  'thermal',
  'aqua',
  'road',
  'fire',
  'twin',
  'core',
  'command',
] as const;
export type ModuleId = (typeof moduleIds)[number];
export type Workspace = ModuleId | 'reports' | 'settings' | 'response' | 'geo' | 'lab';
export type Layer = 'network' | 'traffic' | 'thermal' | 'water';
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  metric: string;
  unit: string;
}
export const modules: ModuleConfig[] = [
  {
    id: 'sky',
    name: 'SKY',
    label: 'Aerial intelligence',
    description:
      'A new perspective on everything below. Explore the aerial platform, its sensors, and recorded observations.',
    color: '#ffb347',
    icon: Radar,
    metric: 'Flight altitude',
    unit: 'm',
  },
  {
    id: 'flow',
    name: 'FLOW',
    label: 'Urban mobility',
    description:
      'Read the rhythm of the city. Trace congestion, compare junctions, and understand movement.',
    color: '#d8ed86',
    icon: Route,
    metric: 'Average speed',
    unit: 'km/h',
  },
  {
    id: 'rescue',
    name: 'RESCUE',
    label: 'Emergency response',
    description:
      'Every second has a location. Follow simulated incidents from detection to resolution.',
    color: '#ff8a72',
    icon: LifeBuoy,
    metric: 'Response time',
    unit: 'min',
  },
  {
    id: 'thermal',
    name: 'THERMAL',
    label: 'Heat intelligence',
    description: 'See what the eye cannot. Explore surface temperature and urban heat islands.',
    color: '#ffb875',
    icon: Thermometer,
    metric: 'Surface temperature',
    unit: '°C',
  },
  {
    id: 'aqua',
    name: 'AQUA',
    label: 'Water & resilience',
    description:
      'Follow water through the urban fabric. Inspect rainfall, drainage capacity, and rising levels.',
    color: '#9fcfd3',
    icon: Droplets,
    metric: 'Water level',
    unit: 'cm',
  },
  {
    id: 'road',
    name: 'ROAD',
    label: 'Infrastructure health',
    description:
      'A closer look at the roads we rely on. Review surface defects and evidence comparisons.',
    color: '#d7c3a4',
    icon: Activity,
    metric: 'Surface health',
    unit: '%',
  },
  {
    id: 'fire',
    name: 'FIRE',
    label: 'Fire & smoke detection',
    description:
      'Earlier awareness, better decisions. Review simulated smoke signatures and thermal evidence.',
    color: '#f9905a',
    icon: Flame,
    metric: 'Thermal anomaly',
    unit: '°C',
  },
  {
    id: 'twin',
    name: 'TWIN',
    label: 'Geographic intelligence twin',
    description:
      'Explore real Gurugram geography, satellite imagery and authorized observations. Illustrative city geometry remains in the homepage experience.',
    color: '#d8ed86',
    icon: Box,
    metric: 'Geographic observations',
    unit: '',
  },
  {
    id: 'core',
    name: 'CORE',
    label: 'Evidence-led intelligence',
    description:
      'Connect signals to understanding. Inspect structured, source-linked analysis from the demo dataset.',
    color: '#d2d2cc',
    icon: BrainCircuit,
    metric: 'Linked observations',
    unit: '',
  },
  {
    id: 'command',
    name: 'COMMAND',
    label: 'Unified operations',
    description:
      'The entire city, in context. Bring every observation and intelligence layer into a single view.',
    color: '#ffb347',
    icon: Gauge,
    metric: 'Active observations',
    unit: '',
  },
];
export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m])) as Record<
  ModuleId,
  ModuleConfig
>;
export const moduleHref = (id: ModuleId) => (id === 'command' ? '/command' : `/command/${id}`);
export function isWorkspace(id: string): id is Workspace {
  return (
    moduleIds.includes(id as ModuleId) ||
    id === 'reports' ||
    id === 'settings' ||
    id === 'response' ||
    id === 'geo' ||
    id === 'lab'
  );
}
export const layerLabels: Record<Layer, string> = {
  network: 'Intelligence network',
  traffic: 'Mobility',
  thermal: 'Surface heat',
  water: 'Water systems',
};
export const layerIcons = {
  network: Layers3,
  traffic: Route,
  thermal: Thermometer,
  water: Droplets,
};
