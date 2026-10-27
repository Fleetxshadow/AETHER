export interface CityBuilding {
  id: string;
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  style: number;
  district: string;
}
function random(seed: number) {
  let x = Math.imul(seed + 1, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}
export const buildings: CityBuilding[] = [];
for (let row = 0; row < 13; row++) {
  for (let col = 0; col < 13; col++) {
    if ([3, 7, 11].includes(row) || [3, 7, 11].includes(col)) continue;
    const x = col * 3.2 - 19.2;
    const z = row * 3.2 - 19.2;
    if (x < -10 && z < 7 && z > -10) continue;
    const seed = row * 17 + col;
    const central = Math.abs(x) < 9 && Math.abs(z) < 9;
    buildings.push({
      id: `B-${row}-${col}`,
      name: `${central ? 'Central' : x > 8 ? 'East' : 'North'} ${['Exchange', 'Residences', 'Works', 'Tower', 'Studios'][seed % 5]} ${seed + 1}`,
      x: x + random(seed) * 0.35,
      z: z + random(seed + 2) * 0.35,
      w: 1.4 + random(seed + 3) * 1.2,
      d: 1.5 + random(seed + 4) * 0.9,
      h: (central ? 4 : 1.3) + random(seed + 1) * (central ? 10 : 5),
      style: seed % 4,
      district: central ? 'Central district' : x > 8 ? 'East interchange' : 'North corridor',
    });
  }
}
export const worldToLngLat = (x: number, z: number): [number, number] => [
  77.594 + x * 0.00075,
  12.974 + z * 0.00065,
];
export const districtPositions: Record<string, [number, number]> = {
  'Central district': [2, 3],
  'East interchange': [13, -4],
  'Riverfront sector': [-14, -7],
  'North corridor': [-5, 13],
  'Industrial quarter': [11, 12],
  'Civic square': [-7, 2],
  'West parkland': [-15, 7],
  'South boulevard': [4, -15],
};
