export type Skin = {
  id: string; // unique id, for planet skins this is the body name; for rocket skins it's the file base name
  title: string;
  // require() returns a number for static image assets in React Native
  preview: number;
  color: number; // hex color applied to rocket materials
  /** Optional wrap mode: 'full' wraps once around; 'half' repeats twice to form two halves. Default 'full'. */
  wrap?: 'full' | 'half';
  /** Optional flag to rotate the skin art by 90 degrees when mapped. Default false. */
  rotate90?: boolean;
};

// Central registry of available skins keyed by the body name that unlocks them
// Only include bodies that have a dedicated image in assets/cbodies/
// Planet/body-themed skins (unlocked by landing on bodies)
const PLANET_SKINS: Record<string, Skin> = {
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

// Rocket skins (unlocked via level-up). Names match file base names in assets/skins.
const ROCKET_SKINS: Record<string, Skin> = {
  'A Friend is a Wonderful Thing': {
    id: 'A Friend is a Wonderful Thing',
    title: 'A Friend is a Wonderful Thing',
    preview: require('../../assets/skins/A Friend is a Wonderful Thing.png'),
    color: 0xffffff,
  },
  Bliss: {
    id: 'Bliss',
    title: 'Bliss',
    preview: require('../../assets/skins/Bliss.png'),
    color: 0xadd8e6,
  },
  Escher: {
    id: 'Escher',
    title: 'Escher',
    preview: require('../../assets/skins/Escher.jpg'),
    color: 0xff6b6b,
  },
  Froggy: {
    id: 'Froggy',
    title: 'Froggy',
    preview: require('../../assets/skins/Froggy.png'),
    color: 0xffff00,
  },
  // Hawaiian: {
  //   id: 'Hawaiian',
  //   title: 'Hawaiian',
  //   preview: require('../../assets/skins/Hawaiian.jpg'),
  //   color: 0xffffff,
  // },
  Saul: {
    id: 'Saul',
    title: 'Saul',
    preview: require('../../assets/skins/Saul.png'),
    color: 0xffd4a3,
    wrap: 'half',
    rotate90: true,
  },
  Solitaire: {
    id: 'Solitaire',
    title: 'Solitaire',
    preview: require('../../assets/skins/Solitaire.png'),
    color: 0xffffff,
  },
  'Go Birds': {
    id: 'Go Birds',
    title: 'Go Birds',
    preview: require('../../assets/skins/Go Birds.png'),
    color: 0x4cbb17,
  },
};

// Merge registries for consumer convenience
export const SKINS: Record<string, Skin> = {
  ...PLANET_SKINS,
  ...ROCKET_SKINS,
};

export const ALL_SKIN_IDS = Object.keys(SKINS);
export const ROCKET_SKIN_IDS = Object.keys(ROCKET_SKINS);

export function hasSkinForBody(bodyName: string): boolean {
  return Boolean(PLANET_SKINS[bodyName]);
}

export function getSkinForBody(bodyName: string): Skin | undefined {
  return PLANET_SKINS[bodyName];
}

export function getSkinById(id: string): Skin | undefined {
  return SKINS[id];
}
