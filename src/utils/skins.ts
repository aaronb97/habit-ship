export type Skin = {
  id: string; // same as CBody name for simplicity
  title: string;
  // require() returns a number for static image assets in React Native
  preview: number;
  color: number; // hex color applied to rocket materials
};

// Central registry of available skins keyed by the body name that unlocks them
// Only include bodies that have a dedicated image in assets/cbodies/
export const SKINS: Record<string, Skin> = {
  Earth: {
    id: 'Earth',
    title: 'Earth',

    preview: require('../../assets/cbodies/earth.jpg'),
    color: 0x6b93d6,
  },
  'The Moon': {
    id: 'The Moon',
    title: 'The Moon',

    preview: require('../../assets/cbodies/moon.jpg'),
    color: 0xc0c0c0,
  },
  Mercury: {
    id: 'Mercury',
    title: 'Mercury',

    preview: require('../../assets/cbodies/mercury.jpg'),
    color: 0xc0c0c0,
  },
  Venus: {
    id: 'Venus',
    title: 'Venus',

    preview: require('../../assets/cbodies/venus.jpg'),
    color: 0xffc649,
  },
  Mars: {
    id: 'Mars',
    title: 'Mars',

    preview: require('../../assets/cbodies/mars.jpg'),
    color: 0xcd5c5c,
  },
  Jupiter: {
    id: 'Jupiter',
    title: 'Jupiter',

    preview: require('../../assets/cbodies/jupiter.jpg'),
    color: 0xd8ca9d,
  },
  Saturn: {
    id: 'Saturn',
    title: 'Saturn',

    preview: require('../../assets/cbodies/saturn.jpg'),
    color: 0xfad5a5,
  },
  Uranus: {
    id: 'Uranus',
    title: 'Uranus',

    preview: require('../../assets/cbodies/uranus.jpg'),
    color: 0x4fd0e7,
  },
  Neptune: {
    id: 'Neptune',
    title: 'Neptune',

    preview: require('../../assets/cbodies/neptune.jpg'),
    color: 0x4b70dd,
  },
  Pluto: {
    id: 'Pluto',
    title: 'Pluto',

    preview: require('../../assets/cbodies/pluto.jpg'),
    color: 0xa0522d,
  },
  Io: {
    id: 'Io',
    title: 'Io',

    preview: require('../../assets/cbodies/io.jpg'),
    color: 0xc0c0c0,
  },
  Europa: {
    id: 'Europa',
    title: 'Europa',

    preview: require('../../assets/cbodies/europa.jpg'),
    color: 0xc0c0c0,
  },
  Ganymede: {
    id: 'Ganymede',
    title: 'Ganymede',

    preview: require('../../assets/cbodies/ganymede.jpg'),
    color: 0xc0c0c0,
  },
  Callisto: {
    id: 'Callisto',
    title: 'Callisto',

    preview: require('../../assets/cbodies/callisto.jpg'),
    color: 0xc0c0c0,
  },
  Titan: {
    id: 'Titan',
    title: 'Titan',

    preview: require('../../assets/cbodies/titan.jpg'),
    color: 0xc0c0c0,
  },
  Iapetus: {
    id: 'Iapetus',
    title: 'Iapetus',

    preview: require('../../assets/cbodies/iapetus.jpg'),
    color: 0xc0c0c0,
  },
  Triton: {
    id: 'Triton',
    title: 'Triton',

    preview: require('../../assets/cbodies/triton.png'),
    color: 0xc0c0c0,
  },
};

export const ALL_SKIN_IDS = Object.keys(SKINS);

export function hasSkinForBody(bodyName: string): boolean {
  return Boolean(SKINS[bodyName]);
}

export function getSkinForBody(bodyName: string): Skin | undefined {
  return SKINS[bodyName];
}

export function getSkinById(id: string): Skin | undefined {
  return SKINS[id];
}
