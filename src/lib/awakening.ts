// Presentation timings, never resource-loading or operational event timestamps.
export const cityWorlds = [
  {
    name: 'Urban road',
    module: 'AETHER SKY',
    detail: 'A road in its ordinary urban context.',
    chapter: 0,
    layer: 'network',
  },
  {
    name: 'Congestion',
    module: 'AETHER FLOW + CORE',
    detail: 'A simulated slowdown. Its cause remains a question.',
    chapter: 1,
    layer: 'traffic',
  },
  {
    name: 'Waterlogging',
    module: 'AETHER AQUA',
    detail: 'Illustrative surface water. No measured extent or depth.',
    chapter: 1,
    layer: 'water',
  },
  {
    name: 'Infrastructure',
    module: 'AETHER ROAD',
    detail: 'An illustrative obstruction, awaiting evidence review.',
    chapter: 1,
    layer: 'thermal',
  },
  {
    name: 'Connected view',
    module: 'AETHER GEO + COMMAND',
    detail: 'Separate observations brought into one human-reviewed context.',
    chapter: 2,
    layer: 'network',
  },
] as const;
export const genesisScenes = [
  {
    at: 0,
    name: 'ABOVE THE CITY',
    title: 'BEYOND THE VISIBLE.',
    detail: 'A different perspective on the city below.',
    module: 'AETHER SKY / ILLUSTRATIVE APPROACH',
  },
  {
    at: 1,
    name: 'CLOSER TO THE SIGNAL',
    title: 'EVERY ROAD TELLS A STORY.',
    detail: 'From the urban horizon to an individual observation.',
    module: 'AETHER SKY → FLOW',
  },
  {
    at: 2.2,
    name: 'URBAN INTELLIGENCE',
    title: 'FOLLOW THE OBSERVATION.',
    detail: 'One connected road. A shared context.',
    module: 'AETHER TWIN',
  },
  {
    at: 3.7,
    name: 'THE INCIDENT EFFECT',
    title: 'A CHANGE. A CLOSER LOOK.',
    detail: 'Anomaly detected. A simulated slowdown focuses the investigation.',
    module: 'AETHER FLOW',
  },
  {
    at: 5,
    name: 'AERIAL INTELLIGENCE',
    title: 'DETECTION IS ONLY THE BEGINNING.',
    detail: 'Possible cause identified. Evidence review required.',
    module: 'FLOW → SKY → CORE',
  },
  {
    at: 6.1,
    name: 'THE INTELLIGENCE REVEAL',
    title: 'AETHER',
    detail: 'THE CITY IS SPEAKING. WE MAKE SENSE OF IT.',
    module: 'ONE CONNECTED ECOSYSTEM',
  },
  {
    at: 7,
    name: 'YOUR PERSPECTIVE',
    title: 'INTELLIGENCE ABOVE. SAFETY BELOW.',
    detail: 'Explore the signals. Inspect the evidence. Enter the real geographic workspace.',
    module: 'AETHER CITY',
  },
] as const;
export function genesisSceneAt(seconds: number) {
  let index = 0;
  for (let i = 1; i < genesisScenes.length; i++) if (seconds >= genesisScenes[i].at) index = i;
  return index;
}
