import { Meter } from './utils/units';
import { DailyPosition } from './types';

export type Planet = {
  name: string;
  distance: Meter; // Distance from Earth in millions of km (converted to meters for consistency)
  description: string;
  system: string;
  minLevel: number;
  isLandable: boolean; // Whether the user can land on this body (excludes gas giants)
  dailyPositions: DailyPosition[]; // Position for each day (30 days)
};

// Helper function to generate mock orbital positions for 30 days
function generateOrbitalPositions(
  baseDistance: number,
  orbitalPeriod: number,
  startAngle: number = 0,
): DailyPosition[] {
  const positions: DailyPosition[] = [];
  const today = new Date('2025-10-06');
  
  for (let day = 0; day < 30; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];
    
    // Calculate position in orbit (simple circular orbit approximation)
    const angle = startAngle + (day / orbitalPeriod) * 2 * Math.PI;
    const x = baseDistance * Math.cos(angle);
    const y = baseDistance * Math.sin(angle);
    const z = baseDistance * 0.05 * Math.sin(angle * 0.3); // Small z variation
    
    positions.push({
      date: dateStr,
      coordinates: { x, y, z },
    });
  }
  
  return positions;
}

export const planets: Planet[] = [
  // Level 1: Inner Solar System - Close neighbors
  {
    name: 'The Moon',
    distance: 384400 as Meter,
    description:
      "Earth's only natural satellite. The closest celestial body to our planet and humanity's first stepping stone into space. A perfect starting point for aspiring space explorers.",
    system: 'Earth System',
    minLevel: 1,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(384400, 27.3, 0),
  },
  {
    name: 'Venus',
    distance: 41400000 as Meter,
    description:
      "Earth's sister planet, shrouded in toxic clouds of sulfuric acid. Despite being closer than Mars, its extreme surface temperature and crushing atmospheric pressure make it one of the most hostile worlds.",
    system: 'Inner Solar System',
    minLevel: 1,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(41400000, 225, 45),
  },
  {
    name: 'Mars',
    distance: 78340000 as Meter,
    description:
      'The Red Planet has captivated humanity for centuries. With its rusty surface, polar ice caps, and ancient river valleys, Mars represents our best hope for establishing a human presence beyond Earth.',
    system: 'Inner Solar System',
    minLevel: 1,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(78340000, 687, 90),
  },

  // Level 2: Asteroid Belt & Beyond
  {
    name: 'Ceres',
    distance: 263000000 as Meter,
    description:
      'The largest object in the asteroid belt between Mars and Jupiter. This dwarf planet harbors a subsurface ocean and mysterious bright spots, making it a fascinating target for exploration.',
    system: 'Asteroid Belt',
    minLevel: 2,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(263000000, 1680, 135),
  },
  {
    name: 'Jupiter',
    distance: 628730000 as Meter,
    description:
      'The King of Planets. This gas giant is so massive that all other planets in our solar system could fit inside it. Its iconic Great Red Spot is a storm larger than Earth itself.',
    system: 'Outer Solar System',
    minLevel: 2,
    isLandable: false, // Gas giant - not landable
    dailyPositions: generateOrbitalPositions(628730000, 4333, 180),
  },
  {
    name: 'Europa',
    distance: 628730000 as Meter,
    description:
      "One of Jupiter's most intriguing moons, covered in a shell of ice concealing a vast global ocean. Scientists believe it could harbor life in its dark, subsurface waters.",
    system: 'Jupiter System',
    minLevel: 2,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(628730000, 4333, 185),
  },
  {
    name: 'Io',
    distance: 628730000 as Meter,
    description:
      "Jupiter's volcanic moon, the most geologically active body in the solar system. Its surface is constantly reshaped by hundreds of active volcanoes.",
    system: 'Jupiter System',
    minLevel: 2,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(628730000, 4333, 175),
  },
  {
    name: 'Ganymede',
    distance: 628730000 as Meter,
    description:
      "The largest moon in the solar system, even bigger than Mercury. Ganymede has its own magnetic field and may have a subsurface ocean.",
    system: 'Jupiter System',
    minLevel: 2,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(628730000, 4333, 190),
  },
  {
    name: 'Callisto',
    distance: 628730000 as Meter,
    description:
      "An ancient, heavily cratered moon of Jupiter. Its surface is one of the oldest in the solar system.",
    system: 'Jupiter System',
    minLevel: 2,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(628730000, 4333, 195),
  },

  // Level 3: Saturn System
  {
    name: 'Saturn',
    distance: 1275000000 as Meter,
    description:
      "The Ringed Wonder. Saturn's magnificent ring system, visible even through small telescopes, has inspired wonder for generations. This gas giant is a jewel of our solar system.",
    system: 'Outer Solar System',
    minLevel: 3,
    isLandable: false, // Gas giant - not landable
    dailyPositions: generateOrbitalPositions(1275000000, 10759, 225),
  },
  {
    name: 'Titan',
    distance: 1275000000 as Meter,
    description:
      "Saturn's largest moon and the only moon in our solar system with a substantial atmosphere. Its surface features lakes and rivers of liquid methane, creating an alien yet strangely familiar landscape.",
    system: 'Saturn System',
    minLevel: 3,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(1275000000, 10759, 230),
  },
  {
    name: 'Enceladus',
    distance: 1275000000 as Meter,
    description:
      'A small, icy moon that sprays geysers of water into space from a subsurface ocean. These dramatic plumes make it one of the most promising places to search for extraterrestrial life.',
    system: 'Saturn System',
    minLevel: 3,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(1275000000, 10759, 220),
  },
  {
    name: 'Rhea',
    distance: 1275000000 as Meter,
    description:
      "Saturn's second-largest moon, an icy world with ancient impact craters.",
    system: 'Saturn System',
    minLevel: 3,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(1275000000, 10759, 235),
  },

  // Level 4: Ice Giants
  {
    name: 'Uranus',
    distance: 2723950000 as Meter,
    description:
      'The Tilted Giant. Uranus rotates on its side, likely due to a massive collision early in its history. This ice giant has a pale blue-green color from methane in its atmosphere.',
    system: 'Outer Solar System',
    minLevel: 4,
    isLandable: false, // Ice giant - not landable
    dailyPositions: generateOrbitalPositions(2723950000, 30687, 270),
  },
  {
    name: 'Neptune',
    distance: 4351400000 as Meter,
    description:
      'The Windiest Planet. Despite being the farthest planet from the Sun, Neptune has the fastest winds in the solar system, reaching speeds of over 2,000 km/h. Its deep blue color is hauntingly beautiful.',
    system: 'Outer Solar System',
    minLevel: 4,
    isLandable: false, // Ice giant - not landable
    dailyPositions: generateOrbitalPositions(4351400000, 60190, 315),
  },
  {
    name: 'Triton',
    distance: 4351400000 as Meter,
    description:
      "Neptune's largest moon, unique for its retrograde orbit. Triton has active nitrogen geysers and is slowly spiraling toward Neptune, destined to be torn apart in tens of millions of years.",
    system: 'Neptune System',
    minLevel: 4,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(4351400000, 60190, 320),
  },

  // Level 5: Kuiper Belt
  {
    name: 'Pluto',
    distance: 5906440000 as Meter,
    description:
      'The Heart of the Frontier. Once considered the ninth planet, Pluto surprised us with its heart-shaped glacier and complex geology when New Horizons visited in 2015. A world of wonder at the edge of exploration.',
    system: 'Kuiper Belt',
    minLevel: 5,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(5906440000, 90560, 0),
  },
  {
    name: 'Charon',
    distance: 5906440000 as Meter,
    description:
      "Pluto's largest moon, so large that Pluto and Charon orbit a common point in space between them.",
    system: 'Kuiper Belt',
    minLevel: 5,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(5906440000, 90560, 5),
  },
  {
    name: 'Makemake',
    distance: 6850000000 as Meter,
    description:
      'One of the largest known dwarf planets in the Kuiper Belt. Named after the creator deity of the Rapa Nui people of Easter Island, this distant world remains largely mysterious.',
    system: 'Kuiper Belt',
    minLevel: 5,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(6850000000, 111845, 45),
  },
  {
    name: 'Eris',
    distance: 10125000000 as Meter,
    description:
      'The dwarf planet whose discovery led to Pluto\'s reclassification. Slightly smaller than Pluto but more massive, Eris orbits in the scattered disc beyond the Kuiper Belt.',
    system: 'Scattered Disc',
    minLevel: 7,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(10125000000, 203500, 90),
  },

  // Level 6+: Interstellar Destinations
  {
    name: 'Proxima Centauri b',
    distance: 39900000000000 as Meter,
    description:
      'The closest known exoplanet to Earth, orbiting our nearest stellar neighbor Proxima Centauri. This potentially rocky world in the habitable zone represents humanity\'s best near-term target for interstellar exploration.',
    system: 'Alpha Centauri System',
    minLevel: 8,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(39900000000000, 11.2, 120),
  },
  {
    name: 'TRAPPIST-1e',
    distance: 376000000000000 as Meter,
    description:
      'One of seven Earth-sized planets orbiting an ultra-cool dwarf star. TRAPPIST-1e sits in the habitable zone and may have conditions suitable for liquid water on its surface.',
    system: 'TRAPPIST-1 System',
    minLevel: 10,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(376000000000000, 6.1, 150),
  },
  {
    name: 'Kepler-452b',
    distance: 13700000000000000 as Meter,
    description:
      'Often called "Earth\'s cousin," this exoplanet orbits a Sun-like star in the habitable zone. It\'s about 60% larger than Earth and may have active volcanoes on its surface.',
    system: 'Kepler-452 System',
    minLevel: 13,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(13700000000000000, 385, 200),
  },
  {
    name: 'PSR B1257+12 System',
    distance: 22700000000000000 as Meter,
    description:
      'The first confirmed planetary system found outside our solar system, orbiting a pulsar. These worlds endure intense radiation from their stellar remnant, representing the extreme diversity of planetary systems.',
    system: 'Pulsar System',
    minLevel: 15,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(22700000000000000, 66.5, 250),
  },
  {
    name: 'Gliese 581g',
    distance: 189000000000000 as Meter,
    description:
      'A controversial exoplanet that may lie in the habitable zone of its red dwarf star. If it exists, it could be one of the most Earth-like worlds ever discovered, though its existence is still debated.',
    system: 'Gliese 581 System',
    minLevel: 20,
    isLandable: true,
    dailyPositions: generateOrbitalPositions(189000000000000, 36.6, 300),
  },
];

// Add Earth as the starting location
export const EARTH: Planet = {
  name: 'Earth',
  distance: 0 as Meter,
  description: 'Home sweet home. The blue marble we call home.',
  system: 'Solar System',
  minLevel: 1,
  isLandable: true,
  dailyPositions: [{ date: '2025-10-06', coordinates: { x: 0, y: 0, z: 0 } }],
};
