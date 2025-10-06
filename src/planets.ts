import { Meter } from './utils/units';

export type Planet = {
  name: string;
  distance: Meter; // Distance from Earth in millions of km (converted to meters for consistency)
  description: string;
  system: string;
  minLevel: number;
};

export const planets: Planet[] = [
  // Level 1: Inner Solar System - Close neighbors
  {
    name: 'The Moon',
    distance: 384400 as Meter, // 384,400 km from Earth
    description:
      "Earth's only natural satellite. The closest celestial body to our planet and humanity's first stepping stone into space. A perfect starting point for aspiring space explorers.",
    system: 'Earth System',
    minLevel: 1,
  },
  {
    name: 'Venus',
    distance: 41400000 as Meter, // ~41.4 million km (closest approach)
    description:
      "Earth's sister planet, shrouded in toxic clouds of sulfuric acid. Despite being closer than Mars, its extreme surface temperature and crushing atmospheric pressure make it one of the most hostile worlds.",
    system: 'Inner Solar System',
    minLevel: 1,
  },
  {
    name: 'Mars',
    distance: 78340000 as Meter, // ~78.34 million km (closest approach)
    description:
      'The Red Planet has captivated humanity for centuries. With its rusty surface, polar ice caps, and ancient river valleys, Mars represents our best hope for establishing a human presence beyond Earth.',
    system: 'Inner Solar System',
    minLevel: 1,
  },

  // Level 2: Asteroid Belt & Beyond - Venturing farther
  {
    name: 'Ceres',
    distance: 263000000 as Meter, // ~263 million km (average)
    description:
      'The largest object in the asteroid belt between Mars and Jupiter. This dwarf planet harbors a subsurface ocean and mysterious bright spots, making it a fascinating target for exploration.',
    system: 'Asteroid Belt',
    minLevel: 2,
  },
  {
    name: 'Jupiter',
    distance: 628730000 as Meter, // ~628.73 million km (closest approach)
    description:
      'The King of Planets. This gas giant is so massive that all other planets in our solar system could fit inside it. Its iconic Great Red Spot is a storm larger than Earth itself.',
    system: 'Outer Solar System',
    minLevel: 2,
  },
  {
    name: 'Europa',
    distance: 628730000 as Meter, // Same as Jupiter
    description:
      "One of Jupiter's most intriguing moons, covered in a shell of ice concealing a vast global ocean. Scientists believe it could harbor life in its dark, subsurface waters.",
    system: 'Jupiter System',
    minLevel: 2,
  },

  // Level 3: Saturn System - Rings and exotic moons
  {
    name: 'Saturn',
    distance: 1275000000 as Meter, // ~1.275 billion km (closest approach)
    description:
      "The Ringed Wonder. Saturn's magnificent ring system, visible even through small telescopes, has inspired wonder for generations. This gas giant is a jewel of our solar system.",
    system: 'Outer Solar System',
    minLevel: 3,
  },
  {
    name: 'Titan',
    distance: 1275000000 as Meter, // Same as Saturn
    description:
      "Saturn's largest moon and the only moon in our solar system with a substantial atmosphere. Its surface features lakes and rivers of liquid methane, creating an alien yet strangely familiar landscape.",
    system: 'Saturn System',
    minLevel: 3,
  },
  {
    name: 'Enceladus',
    distance: 1275000000 as Meter, // Same as Saturn
    description:
      'A small, icy moon that sprays geysers of water into space from a subsurface ocean. These dramatic plumes make it one of the most promising places to search for extraterrestrial life.',
    system: 'Saturn System',
    minLevel: 3,
  },

  // Level 4: Ice Giants - The distant blue worlds
  {
    name: 'Uranus',
    distance: 2723950000 as Meter, // ~2.724 billion km (closest approach)
    description:
      'The Tilted Giant. Uranus rotates on its side, likely due to a massive collision early in its history. This ice giant has a pale blue-green color from methane in its atmosphere.',
    system: 'Outer Solar System',
    minLevel: 4,
  },
  {
    name: 'Neptune',
    distance: 4351400000 as Meter, // ~4.351 billion km (closest approach)
    description:
      'The Windiest Planet. Despite being the farthest planet from the Sun, Neptune has the fastest winds in the solar system, reaching speeds of over 2,000 km/h. Its deep blue color is hauntingly beautiful.',
    system: 'Outer Solar System',
    minLevel: 4,
  },
  {
    name: 'Triton',
    distance: 4351400000 as Meter, // Same as Neptune
    description:
      "Neptune's largest moon, unique for its retrograde orbit. Triton has active nitrogen geysers and is slowly spiraling toward Neptune, destined to be torn apart in tens of millions of years.",
    system: 'Neptune System',
    minLevel: 4,
  },

  // Level 5: Kuiper Belt - Edge of the solar system
  {
    name: 'Pluto',
    distance: 5906440000 as Meter, // ~5.906 billion km (average)
    description:
      'The Heart of the Frontier. Once considered the ninth planet, Pluto surprised us with its heart-shaped glacier and complex geology when New Horizons visited in 2015. A world of wonder at the edge of exploration.',
    system: 'Kuiper Belt',
    minLevel: 5,
  },
  {
    name: 'Makemake',
    distance: 6850000000 as Meter, // ~6.85 billion km (average)
    description:
      'One of the largest known dwarf planets in the Kuiper Belt. Named after the creator deity of the Rapa Nui people of Easter Island, this distant world remains largely mysterious.',
    system: 'Kuiper Belt',
    minLevel: 5,
  },
  {
    name: 'Eris',
    distance: 10125000000 as Meter, // ~10.125 billion km (average)
    description:
      'The dwarf planet whose discovery led to Pluto\'s reclassification. Slightly smaller than Pluto but more massive, Eris orbits in the scattered disc beyond the Kuiper Belt.',
    system: 'Scattered Disc',
    minLevel: 7,
  },

  // Level 6+: Interstellar Destinations - Beyond our solar system
  {
    name: 'Proxima Centauri b',
    distance: 39900000000000 as Meter, // ~4.24 light-years
    description:
      'The closest known exoplanet to Earth, orbiting our nearest stellar neighbor Proxima Centauri. This potentially rocky world in the habitable zone represents humanity\'s best near-term target for interstellar exploration.',
    system: 'Alpha Centauri System',
    minLevel: 8,
  },
  {
    name: 'TRAPPIST-1e',
    distance: 376000000000000 as Meter, // ~39.5 light-years
    description:
      'One of seven Earth-sized planets orbiting an ultra-cool dwarf star. TRAPPIST-1e sits in the habitable zone and may have conditions suitable for liquid water on its surface.',
    system: 'TRAPPIST-1 System',
    minLevel: 10,
  },
  {
    name: 'Kepler-452b',
    distance: 13700000000000000 as Meter, // ~1,400 light-years
    description:
      'Often called "Earth\'s cousin," this exoplanet orbits a Sun-like star in the habitable zone. It\'s about 60% larger than Earth and may have active volcanoes on its surface.',
    system: 'Kepler-452 System',
    minLevel: 13,
  },
  {
    name: 'PSR B1257+12 System',
    distance: 22700000000000000 as Meter, // ~2,300 light-years
    description:
      'The first confirmed planetary system found outside our solar system, orbiting a pulsar. These worlds endure intense radiation from their stellar remnant, representing the extreme diversity of planetary systems.',
    system: 'Pulsar System',
    minLevel: 15,
  },
  {
    name: 'Gliese 581g',
    distance: 189000000000000 as Meter, // ~20 light-years
    description:
      'A controversial exoplanet that may lie in the habitable zone of its red dwarf star. If it exists, it could be one of the most Earth-like worlds ever discovered, though its existence is still debated.',
    system: 'Gliese 581 System',
    minLevel: 20,
  },
];
