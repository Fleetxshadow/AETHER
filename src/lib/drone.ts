export const droneParts = {
  airframe: {
    number: '01',
    label: 'Carbon composite airframe',
    detail:
      'Illustrative monocoque structure. Houses the flight stack and distributes loads across four radial arms.',
    specification: 'Composite shell · conceptual design',
  },
  propulsion: {
    number: '02',
    label: 'Brushless propulsion',
    detail:
      'Four independently illustrated motor and propeller assemblies. This view is an engineering concept, not a validated flight system.',
    specification: '4 × motor assemblies · illustrative',
  },
  battery: {
    number: '03',
    label: 'Modular energy pack',
    detail:
      'A removable energy module sits above the controller. Exploded view reveals how the visual assemblies fit together.',
    specification: '6S energy module · illustrative',
  },
  camera: {
    number: '04',
    label: 'Multisensor gimbal',
    detail:
      'An illustrative stabilized RGB and thermal sensor assembly, positioned below the airframe for unobstructed observation.',
    specification: 'RGB + LWIR · conceptual payload',
  },
  controller: {
    number: '05',
    label: 'Flight & sensor computer',
    detail:
      'The processing layer coordinates sensor data in this conceptual assembly. No hardware connection or flight control is provided.',
    specification: 'Sensor processing · illustrative',
  },
};
export type DronePart = keyof typeof droneParts;
